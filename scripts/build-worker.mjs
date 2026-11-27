import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const nxapiDir = resolve(dirname(require.resolve('nxapi')), '..');
const pkg = JSON.parse(await readFile(resolve(nxapiDir, '../package.json'), 'utf8'));
const undiciDir = dirname(createRequire(require.resolve('nxapi')).resolve('undici/package.json'));
const runtimeFile = resolve(root, 'src/nintendo/worker-runtime.ts');
const bridge = JSON.stringify(runtimeFile);
const coralFile = resolve(nxapiDir, 'api/coral.js');
const coralVersion = (await readFile(coralFile, 'utf8')).match(/export const ZNCA_VERSION = '([^']+)'/)?.[1];
const version = pkg.version.split('-')[0];
const revision = pkg.__nxapi_git?.revision;
if (!coralVersion || !revision) throw new Error('Cannot read nxapi build metadata');
const refresh = process.argv.includes('--refresh');

await build({
  absWorkingDir: root,
  entryPoints: [refresh ? 'src/jobs/refresh-presence.ts' : 'src/worker.ts'],
  outfile: refresh ? '.wrangler/worker/refresh.mjs' : '.wrangler/worker/worker.mjs',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  target: 'es2022',
  external: ['node:*'],
  plugins: [{
    name: 'nxapi-worker',
    setup(plugin) {
      plugin.onResolve({ filter: /^undici$/ }, ({ importer }) => {
        if (!importer.startsWith(nxapiDir + sep)) return;
        if (importer === resolve(nxapiDir, 'util/errors.js')) {
          return { path: 'errors', namespace: 'nxapi-undici' };
        }
        return { path: runtimeFile };
      });
      plugin.onLoad({ filter: /^errors$/, namespace: 'nxapi-undici' }, () => ({
        contents: 'export { default as errors } from ' + JSON.stringify(resolve(undiciDir, 'lib/core/errors.js')),
        resolveDir: root,
      }));

      plugin.onLoad({ filter: /[\\/](product|debug|coral|f)\.js$/ }, async ({ path }) => {
        if (!path.startsWith(nxapiDir + sep)) return;
        const resolveDir = dirname(path);
        if (path === resolve(nxapiDir, 'util/product.js')) {
          return { resolveDir, contents: `
            export const pkg = ${JSON.stringify({ version: pkg.version })};
            export const version = ${JSON.stringify(version)};
            export const git = ${JSON.stringify({ revision })};
            export const dev = false, docker = false, release = null;
            export const product = 'nxapi ' + version;
            export const dir = '/', paths = { data: '/tmp', cache: '/tmp' };
            export const embedded_nxapi_auth_app_client_id = undefined;
            export const embedded_nxapi_auth_cli_client_id = undefined;
          ` };
        }
        if (path === resolve(nxapiDir, 'util/debug.js')) {
          // nxapi's debug messages may contain account tokens and decrypted payloads.
          return { resolveDir, contents: 'export default () => () => {};' };
        }
        if (path === resolve(nxapiDir, 'exports/coral.js')) {
          // Load the Coral API without the CLI's storage and optional proxy client.
          return { resolveDir, contents: `
            export { default, CoralErrorResponse } from '../api/coral.js';
            export { CoralStatus } from '../api/coral-types.js';
          ` };
        }
        if (path !== coralFile && path !== resolve(nxapiDir, 'api/f.js')) return;

        // Use request-scoped fetch instead of nxapi's startup-time disk and network I/O.
        const input = await readFile(path, 'utf8');
        const configImport = "import('../common/remote-config.js')";
        if (!input.includes(configImport)) throw new Error('nxapi remote configuration import changed');
        const metadata = [version, revision, coralVersion].map(JSON.stringify).join(', ');
        let contents = input.replaceAll(configImport, `loadNxapiConfig(${metadata})`);
        if (path !== coralFile) {
          const processImport = "import process from 'node:process';";
          if (!contents.includes(processImport)) throw new Error('nxapi authentication environment changed');
          contents = contents.replace(processImport, '').replaceAll('process.env.', 'nxapiAuthEnv().');
        }
        return {
          resolveDir,
          contents: `import { loadNxapiConfig, nxapiAuthEnv } from ${bridge};\n` + contents,
        };
      });
    },
  }],
});
