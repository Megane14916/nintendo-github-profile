# Nintendo Switch GitHub Presence Card

Nintendo Switch のオンライン状態やプレイ中のゲームを、GitHub プロフィールに埋め込める SVG カードとして表示します。
オフライン時は、定期更新で最後に確認したゲームも表示します。

- カードの掲載例 [Megane14916 の GitHub プロフィール](https://github.com/Megane14916)

![Nintendo Switch プレイ状況のカード例](https://nintendo-github-presence.yoanz.workers.dev/card.svg?style=default)

## 使用技術

| 領域 | 技術 |
| --- | --- |
| API・描画 | TypeScript、Hono、SVG |
| 取得元 | nxapi、nxapi-auth Presence API |
| 定期更新・保存 | Cloudflare Workers Cron Triggers、Workers KV |
| 開発・テスト | Wrangler、Vitest |

## システム構成

Cron が2分ごとにプレイ状況と画像を取得し、KV に保存します。カードを開くと、Worker が KV の内容を SVG にして返します。

```text
[Workers Cron] ──取得──▶ [自前 nxapi / nxapi-auth Presence API]
      │
      └──状態と画像を保存──▶ [Workers KV]
                                  │ 読み出し
                                  ▼
[GitHub プロフィール] ◀── SVG ── [Worker /card.svg]
```

## 開発環境構築

Node.js 22.12 以降を使用します。リポジトリ直下で実行してください（PowerShell）。

```powershell
npm ci
npm run dev -- --var PREVIEW_STATUS:playing
```

[ローカルのカード](http://localhost:8787/card.svg) でサンプルを確認できます。実データを使う場合は、次の節で取得元を設定してから `npm run refresh` でローカル KV を更新し、`npm run dev` で起動します。

## 環境変数

[`.dev.vars.example`](.dev.vars.example) を `.dev.vars` にコピーして設定します。

### nxapi-auth Presence API で接続する

1. nxapi-auth にサインインし、フレンドコードを入力して表示したい Nintendo Switch ユーザーを連携します。画面の案内に従って、本体のニックネームを使った確認を完了します。[nxapi-auth](https://nxapi-auth.fancy.org.uk/)
2. **Set up now** から Presence API を有効にします。表示されたサーバーアカウントからのフレンド申請を Switch 本体で承認し、そのアカウントにオンライン状況を公開します。[公式の設定手順](https://github.com/samuelthomas2774/nxapi/discussions/155#presence-api-using-nxapi-auth)
3. 発行された **JSON 用の Presence URL** をコピーします。URL を生成するときは Event stream をオフにします。

```dotenv
PRESENCE_SOURCE="nxapi-auth"
NXAPI_PRESENCE_URL="https://example.invalid/presence.json"
```

### 自前 nxapi で接続する

サブアカウントと表示対象のメインアカウントをフレンドにし、メインのオンライン状況をサブに公開します。nxapi CLI でサブを認証し、`npx --no-install nxapi nso friends` でメインの NSA ID を確認します。nxapi-auth で `Public` の OAuth クライアントを作り、`Client credentials` と `ca:gf ca:er ca:dr` を有効にします。[nxapi CLI の認証手順](https://github.com/samuelthomas2774/nxapi/blob/main/docs/cli.md#login-to-the-nintendo-switch-online-app) · [OAuth クライアント設定](https://github.com/samuelthomas2774/nxapi#nxapi-auth-authentication)

| 変数 | 値 |
| --- | --- |
| `PRESENCE_SOURCE` | `self` |
| `MAIN_NSA_ID` | メインアカウントの NSA ID |
| `NINTENDO_SESSION_TOKEN` | サブアカウントのセッショントークン |
| `NXAPI_AUTH_CLIENT_ID` | 発行された Client ID |
| `NXAPI_AUTH_CLIENT_SECRET` | Client Secret が発行された場合に設定 |

セッショントークンと Presence URL はローカルの設定ファイルか、本番の Worker Secret で管理します。

## テスト

```powershell
npm run check
npm test
```

## デプロイ

`wrangler.jsonc` の `vars.PRESENCE_SOURCE` を取得元に合わせます。対応する設定値を JSON オブジェクトにし、Git 管理対象外の `.env.production.json` に保存します。Presence API 方式でアップロードするキーは `NXAPI_PRESENCE_URL` です。自前方式では上の表の ID とトークンを指定します。[Cloudflare の Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/#upload-secrets-alongside-code)

```powershell
npx wrangler login
npx wrangler deploy --secrets-file .env.production.json
```

デプロイ後、Cron の初回更新を待ち、発行された URL をプロフィール README に画像として貼ります。デザインは `style`、表示言語は `lang=ja`（省略時の既定値）または `lang=en` で選べます。

```md
![Nintendo Switch Activity](https://<worker-domain>/card.svg?style=default&lang=en)
```

最後の正常更新から10分経つと「状態を取得できません」と表示します。GitHub 上の表示は画像キャッシュで遅れる場合があります。
最近プレイしたゲームは、Cron がプレイ中のタイトルを確認した時点から表示できます。指定言語のゲーム名を Nintendo eショップから取得できないときは、取得元が返した名前を使います。
