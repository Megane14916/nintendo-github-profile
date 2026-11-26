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

nxapi-auth で取得した JSON 用 Presence URL を、`.dev.vars.example` をコピーした `.dev.vars` の `NXAPI_PRESENCE_URL` に設定して `npm run dev` を実行します。公開時は同じ名前の Worker Secret を設定します。URL は秘密情報として扱ってください。公開する前に nxapi-auth 側の公開範囲を確認してください。

公開後は、プロフィール README の画像 URL に Worker の URL を指定します。

```md
![Nintendo Switch Activity](https://<worker-domain>/card.svg)
```

実 API の成功応答は最大90秒キャッシュします。GitHub 上では画像プロキシによって反映がさらに遅れることがあります。

## 構成

- `src/presence/nxapi.ts` が設定済みの URL から JSON を取得します。
- `src/presence/normalize.ts` が [nxapi の公開実装](https://github.com/samuelthomas2774/nxapi/blob/main/src/cli/presence-server.ts) に沿ってデータを内部モデルに変換します。
- `src/render/assets.ts` が許可された画像を取得してデータ URI に変換します。
- レイアウトは `src/render/layouts/`、配色と文字サイズは `src/render/themes.ts` で変更できます。
