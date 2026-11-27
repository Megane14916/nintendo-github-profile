import type { CardLanguage, LastPlayedGame } from '../model/presence';

const MAX_HEAD_BYTES = 64 * 1024;
const MAX_REDIRECTS = 5;
const STORE_TIMEOUT_MS = 3500;
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const STORES = {
  ja: { region: 'JP', host: 'store-jp.nintendo.com', path: /^\/item\/software\/D\d+\/?$/ },
  en: { region: 'US', host: 'www.nintendo.com', path: /^\/(?:us\/)?store\/products\/[^/]+\/?$/ },
};
const ENTITIES = new Map([
  ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"],
  ['nbsp', ' '], ['trade', '™'], ['reg', '®'], ['copy', '©'],
]);

// Keep three Unicode titles and their identifiers within KV's 1 KiB metadata limit.
export function limitGameTitle(title: string): string {
  const cleaned = title.replace(/\s+/gu, ' ').replace(/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/gu, '').trim();
  return Array.from(cleaned).slice(0, 64).join('').trimEnd();
}

function decodeTitle(title: string): string {
  return title.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (escaped, entity: string) => {
    if (!entity.startsWith('#')) return ENTITIES.get(entity.toLowerCase()) ?? escaped;
    const codePoint = /^#x/i.test(entity) ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return codePoint > 0 && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff)
      ? String.fromCodePoint(codePoint)
      : '\uFFFD';
  });
}

async function readPageTitle(body: ReadableStream<Uint8Array>): Promise<string | undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let remaining = MAX_HEAD_BYTES;
  let head = '';
  try {
    while (remaining > 0) {
      const { done, value } = await reader.read();
      if (done) return;
      const chunk = value.subarray(0, remaining);
      remaining -= chunk.byteLength;
      head += decoder.decode(chunk, { stream: true });
      const title = head.match(/<title\b[^>]*>([^<]+)<\/title\s*>/i)?.[1];
      if (title) return decodeTitle(title);
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function fetchTitle(titleId: string, language: CardLanguage): Promise<string | undefined> {
  const store = STORES[language];
  const signal = AbortSignal.timeout(STORE_TIMEOUT_MS);
  let url = new URL('https://ec.nintendo.com/apps/' + titleId + '/' + store.region);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await fetch(url, { headers: { Accept: 'text/html' }, redirect: 'manual', signal });
      if (response.ok && url.hostname === store.host && store.path.test(url.pathname)
        && response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() === 'text/html'
        && response.body) {
        const pageTitle = await readPageTitle(response.body);
        const name = pageTitle?.replace(/\s*[|｜]\s*(?:My )?(?:Nintendo Store|マイニンテンドーストア).*$/iu, '')
          .replace(/\s*[-–|]\s*Nintendo Official Site.*$/iu, '')
          .replace(/\s+for Nintendo Switch[™®]?(?: 2[™®]?)?$/iu, '');
        return name && limitGameTitle(name) || undefined;
      }

      void response.body?.cancel().catch(() => {});
      const location = response.headers.get('Location');
      if (!REDIRECT_STATUS.has(response.status) || !location) return;
      url = new URL(location, url);
      if (url.protocol !== 'https:' || url.username || url.password || url.port
        || (url.hostname !== 'ec.nintendo.com' && url.hostname !== store.host)) return;
    }
  } catch {
    // Shop metadata is optional. Presence can still be saved with the upstream title.
  }
}

export async function fetchGameTitles(titleId: string): Promise<LastPlayedGame['titles']> {
  const [ja, en] = await Promise.all([fetchTitle(titleId, 'ja'), fetchTitle(titleId, 'en')]);
  return ja || en ? { ...(ja ? { ja } : {}), ...(en ? { en } : {}) } : undefined;
}
