# Nintendo Switch GitHub Presence Card

Nintendo Switch のプレイ状況を SVG にして返す、Hono と TypeScript の Cloudflare Worker です。公開用のパスは `/card.svg` です。

## ローカルで確認

Node.js 22.12 以降で実行します。

```sh
npm ci
npm run dev -- --var PREVIEW_STATUS:playing
```

[http://localhost:8787/card.svg](http://localhost:8787/card.svg) でサンプルが表示されます。起動時の `playing` を `online`、`offline`、`unknown` に替えると、別の状態を確認できます。サンプルのゲーム名とユーザー名は架空です。

```sh
npm run check
npm test
```

## デザインの切り替え

すべてのカードで背景は `#E4000F` です。`/card.svg` は従来のデザインで、`/card.svg?style=green` では同じ配置のままオンライン表示を緑にできます。

### 個別にデザインした24案

`/card.svg?style=orbit` のように、案の名前を指定します。

| 主役 | 選べる案 |
| --- | --- |
| 文字 | `type`、`folio`、`baseline`、`mono`、`minutes`、`quiet` |
| ゲーム画像 | `orbit`、`postcard`、`panorama`、`contact`、`sleeve`、`instant` |
| プロフィール | `identity`、`speech`、`corner`、`live`、`ribbon`、`pass` |
| 遊びのある形 | `ticket`、`handheld`、`pixels`、`scoreboard`、`sunrise`、`sticker` |

### レイアウトと書体を組み合わせた36案

36案から選ぶには、下のレイアウト名に `-white`、`-mint`、`-serif` のいずれかを付けます。たとえば、`/card.svg?style=profile-mint` で、プロフィールを上段に置いた緑のラベルのカードを表示します。

| 書体とラベル | 特徴 |
| --- | --- |
| `white` | ゴシック体と白い丸型ラベル |
| `mint` | 丸ゴシック優先と緑のラベル |
| `serif` | 明朝体とクリーム色のラベル |

| レイアウト名 | 配置 |
| --- | --- |
| `cover` | 左に大きなカバー、右に情報 |
| `profile` | 上段にプロフィールと状態 |
| `reverse` | 大きなカバーを右側に配置 |
| `footer` | プロフィールと状態を下段にまとめる |
| `compact` | 小さいカバーと中央の情報、右端の状態 |
| `rail` | 左の縦列にプロフィール、右にカバー |
| `headline` | ゲーム名を上段、カバーとプロフィールを下段に配置 |
| `frame` | 細い額縁の内側にカバーと情報 |
| `ticket` | 点線でゲーム情報とプロフィールを区切る |
| `centered` | 状態とゲーム名を中央、カバーとプロフィールを両端に配置 |
| `stacked` | ゲーム名を上中央、カバーを下中央に配置 |
| `gallery` | カバー、プロフィール、ゲーム情報の3列 |

以前の `style=profile` は `profile-white`、`style=editorial` は `reverse-serif` と同じ表示です。プロフィール README でも、画像 URL に `?style=...` を追加できます。

## 実 API への接続

### 自前 nxapi

1. Nintendo Switch 本体に連携したサブアカウントとメインアカウントをフレンドにし、メインアカウントのオンライン状態をサブアカウントに公開します。
2. ローカルの nxapi CLI でサブアカウントを認証し、`npx --no-install nxapi nso friends` でメインアカウントの状態と **NSA ID** を確認します。CLI のローカルデータにある `NintendoAccountToken.<サブアカウントの Nintendo Account ID>` の値を使います。トークンや認証時の出力を共有しないでください。[nxapi CLI の認証手順](https://github.com/samuelthomas2774/nxapi/blob/main/docs/cli.md#login-to-the-nintendo-switch-online-app)
3. nxapi-auth で `Public` の OAuth クライアントを登録し、`Client credentials` と `ca:gf ca:er ca:dr` の3つのスコープを有効にします。Coral 認証と通信の暗号化・復号には nxapi の認証補助サービスを使い、Nintendo が発行した短期トークンを同サービスへ送信します。[クライアント登録](https://nxapi-auth.fancy.org.uk/oauth/clients) · [Coral 認証の仕様](https://github.com/samuelthomas2774/nxapi#coral-client-authentication)
4. `.dev.vars.example` を `.dev.vars` にコピーし、次の値を設定します。保存後に「ローカル KV の手動更新」の手順を実行します。

| 変数 | 設定値 |
| --- | --- |
| `PRESENCE_SOURCE` | `self` |
| `MAIN_NSA_ID` | メインアカウントの NSA ID（16桁の16進数） |
| `NINTENDO_SESSION_TOKEN` | サブアカウントの Nintendo セッショントークン |
| `NXAPI_AUTH_CLIENT_ID` | 登録した OAuth クライアント ID |
| `NXAPI_AUTH_CLIENT_SECRET` | 発行された場合に設定する OAuth クライアントシークレット |

プレイ中、オンライン、オフラインの各状態で手動更新すると、ゲーム名や状態の表示を確認できます。取得に失敗した場合は更新コマンドに失敗した処理が表示されます。

### nxapi-auth の Presence API

`PRESENCE_SOURCE=nxapi-auth` に変更し、取得した JSON 用 Presence URL を `NXAPI_PRESENCE_URL` に設定します。以前から `NXAPI_PRESENCE_URL` を利用している場合は、`PRESENCE_SOURCE` が空でも同じ接続が使えます。両方を空にすると `PREVIEW_STATUS` でサンプルを表示できます。

公開時は `NINTENDO_SESSION_TOKEN`、`NXAPI_AUTH_CLIENT_SECRET`、`NXAPI_PRESENCE_URL` を、利用する取得元に応じて Worker Secret に設定します。ローカルの `.dev.vars` は Git の管理対象外です。

### ローカル KV の手動更新

実 API の設定後、プロジェクトのディレクトリで実行します。

```sh
npm run refresh
npm run dev
```

`refresh` は設定した取得元から最新の状態と画像を取得し、ローカルの `PRESENCE_KV` に1件保存します。`/card.svg` は保存内容を読み、更新から10分で「状態を取得できません」と表示します。新しい状態を確認するときは、再度 `npm run refresh` を実行してください。更新に失敗した場合、既存のスナップショットは次の正常更新まで保持されます。[ローカルのカード](http://localhost:8787/card.svg)

Wrangler はローカルの KV を自動作成します。本番への初回デプロイ時は、同じ設定からアカウントに KV 名前空間をプロビジョニングできます。[Wrangler の自動プロビジョニング](https://developers.cloudflare.com/workers/wrangler/configuration/#automatic-provisioning)

### Cron 更新

デプロイ後は Cloudflare Cron が2分ごとに状態と画像を取得し、同じ KV キーを更新します。ローカルで Cron を1回試すには、開発サーバーを起動し、別のターミナルから次の URL にアクセスします。[Cloudflare の Cron テスト手順](https://developers.cloudflare.com/workers/configuration/cron-triggers/#test-cron-triggers-locally)

```sh
npm run dev -- --test-scheduled
# 別のターミナルで実行
curl "http://localhost:8787/cdn-cgi/local/scheduled?format=json"
```

結果の `outcome` が `ok` なら [ローカルのカード](http://localhost:8787/card.svg) を開きます。更新に失敗した場合は Worker ログの `presence_refresh_failed` に失敗した処理が表示されます。次の定期実行で再度取得します。

公開後は、プロフィール README の画像 URL に Worker の URL を指定します。

```md
![Nintendo Switch Activity](https://<worker-domain>/card.svg)
```

カードのキャッシュは最大90秒で、スナップショットの有効期限が近い場合は短くなります。GitHub 上では画像プロキシによって反映がさらに遅れることがあります。

## 構成

- `src/presence/provider.ts` が取得元を選び、`src/presence/normalize.ts` がフレンドのデータを内部モデルに変換します。
- `src/nintendo/` がサブアカウントで認証し、指定したフレンドの状態を取得します。短期トークンは Worker 内のメモリで再利用します。
- `src/worker.ts` が HTTP と Cron を受け取り、`src/jobs/refresh-presence.ts` が定期更新と手動更新の処理を共通化します。
- `scripts/build-worker.mjs` が nxapi の Coral クライアントを Workers 向けにバンドルします。検証した nxapi プレリリースを固定し、公開設定の Coral 互換バージョンをリクエスト時に取得します。
- `src/render/assets.ts` が許可された画像を取得してデータ URI に変換します。
- `src/storage/presence.ts` がスナップショットを検証し、KV の `presence:current` で読み書きします。
- レイアウトは `src/render/layouts/`、配色と文字サイズは `src/render/themes.ts` で変更できます。
