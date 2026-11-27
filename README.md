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
4. `.dev.vars.example` を `.dev.vars` にコピーし、次の値を設定します。`npm run dev` で起動し、[ローカルのカード](http://localhost:8787/card.svg) を開きます。

| 変数 | 設定値 |
| --- | --- |
| `PRESENCE_SOURCE` | `self` |
| `MAIN_NSA_ID` | メインアカウントの NSA ID（16桁の16進数） |
| `NINTENDO_SESSION_TOKEN` | サブアカウントの Nintendo セッショントークン |
| `NXAPI_AUTH_CLIENT_ID` | 登録した OAuth クライアント ID |
| `NXAPI_AUTH_CLIENT_SECRET` | 発行された場合に設定する OAuth クライアントシークレット |

設定後、プレイ中、オンライン、オフラインでゲーム名や状態が変わることを確認できます。認証や取得に失敗すると、カードには「状態を取得できません」と表示されます。Worker の `presence_unavailable` ログには失敗した処理と分類が記録されます。

### nxapi-auth の Presence API

`PRESENCE_SOURCE=nxapi-auth` に変更し、取得した JSON 用 Presence URL を `NXAPI_PRESENCE_URL` に設定します。以前から `NXAPI_PRESENCE_URL` を利用している場合は、`PRESENCE_SOURCE` が空でも同じ接続が使えます。両方を空にすると `PREVIEW_STATUS` でサンプルを表示できます。

公開時は `NINTENDO_SESSION_TOKEN`、`NXAPI_AUTH_CLIENT_SECRET`、`NXAPI_PRESENCE_URL` を、利用する取得元に応じて Worker Secret に設定します。ローカルの `.dev.vars` は Git の管理対象外です。

公開後は、プロフィール README の画像 URL に Worker の URL を指定します。

```md
![Nintendo Switch Activity](https://<worker-domain>/card.svg)
```

実 API の成功応答は最大90秒キャッシュします。GitHub 上では画像プロキシによって反映がさらに遅れることがあります。

## 構成

- `src/presence/provider.ts` が取得元を選び、`src/presence/normalize.ts` がフレンドのデータを内部モデルに変換します。
- `src/nintendo/` がサブアカウントで認証し、指定したフレンドの状態を取得します。短期トークンは Worker 内のメモリで再利用します。
- `scripts/build-worker.mjs` が nxapi の Coral クライアントを Workers 向けにバンドルします。検証した nxapi プレリリースを固定し、公開設定の Coral 互換バージョンをリクエスト時に取得します。
- `src/render/assets.ts` が許可された画像を取得してデータ URI に変換します。
- レイアウトは `src/render/layouts/`、配色と文字サイズは `src/render/themes.ts` で変更できます。
