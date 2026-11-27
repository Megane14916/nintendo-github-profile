# Nintendo Switch GitHub Presence Card — 設計書・実装計画

> 最終更新: 2026-11-27
>
> 目的: 自分のNintendo Switchのプレイ状況を、GitHubプロフィールREADMEに独自デザインの画像として埋め込む。まずAIに最低限の実装を作らせ、デザインは後から独立して変更できるようにする。

## 1. 方針・スコープ

### 採用する方針

- **新規リポジトリで開発する。** `nxapi`をフォークしない。
- **データ取得には自前の nxapi を使い、設定で nxapi-auth の Presence API に切り替えられるようにする。** 自前方式ではサブアカウントで認証し、メインアカウントのフレンド情報を取得する。
- **Webサービスは作らない。** 設定画面、ユーザー登録、ログイン、DB、一般ユーザー向けURL発行機能は不要。
- **Cloudflare Worker の Cron で取得したデータを KV に保存し、GitHub README 用の HTTP エンドポイントで SVG を返す。**
- **データ取得・データ整形・SVG描画を分離する。** 後でデザインだけを差し替えても、API処理やデータ型を変更せずに済むようにする。
- 現行の実装順序と検証状況は [plan2.md](plan2.md) を参照する。

### MVPで実装すること

- 現在の状態（プレイ中／オンラインだがプレイしていない／オフライン／取得失敗）を表示する。
- プレイ中であればゲーム名・ゲーム画像・Switchのプロフィール名・アイコンを表示する（取得可能な項目のみ）。
- ゲームを起動していないときも、レイアウトが崩れないカードを表示する。
- 公開URL `https://<worker-domain>/card.svg` からSVGを返す。
- GitHub READMEの `![Nintendo Activity](https://<worker-domain>/card.svg)` で表示できることを確認する。
- デザイン用モジュールを明確に独立させる。

### 今回やらないこと

- ユーザー管理、認証UI、プレイグラウンド、デザイン設定画面、マルチテナント化
- ブラウザー向けの任天堂ログイン画面、nxapi Presence サーバーの運用
- Steam・Discordなど他プラットフォームとの統合
- プレイ履歴のDB保存、過去数ゲームのランキング、日別プレイ時間のグラフ
- 正確なリアルタイム性の保証（GitHubの画像プロキシによるキャッシュは制御できない）

**補足：** Presence APIは主に現在／直近の状態を返すものとして扱う。「最近遊んだゲーム5件」のような履歴一覧は、このAPIだけで取得できると仮定しない。必要になったら別フェーズで履歴取得・保存方式を検討する。

## 2. 全体構成

```text
Cloudflare Worker（Hono + TypeScript）
   ├─ Cron（2分間隔）→ 自前 nxapi または nxapi-auth Presence API
   │                   ↓ 正規化・画像取得
   │                   KV（presence:current）
   └─ GET /card.svg    KV を読み image/svg+xml を返す
   ↓ 公開画像URL
GitHubプロフィール README.md
```

- 自分のREADMEが参照するのは **自作Workerの `/card.svg`**。
- 取得元の設定には `PRESENCE_SOURCE` を使う。nxapi-auth を選んだ場合は JSON 用の Presence URL を設定する。
- 保存データは KV のスナップショット1件とする。取得元と認証情報は Worker 変数と Secrets で管理する。
- Honoを採用するが、ルートは最小限にする。独自APIの公開や汎用サービス化は目的にしない。

## 3. ディレクトリ構成

```text
nintendo-github-presence/
├─ src/
│  ├─ worker.ts                 # HTTP と Cron の入口
│  ├─ index.ts                  # HTTP ルート。KV から読み出して描画する
│  ├─ config.ts                 # 設定値・許可されたテーマなど
│  ├─ model/
│  │  └─ presence.ts            # 外部APIに依存しない内部データ型
│  ├─ presence/
│  │  ├─ providers/             # 自前 nxapi と nxapi-auth の取得実装
│  │  └─ normalize.ts           # レスポンスの検証と内部モデルへの変換
│  ├─ jobs/                     # 定期更新と手動更新の共通処理
│  ├─ storage/                  # KV スナップショットの検証と保存
│  ├─ render/
│  │  ├─ card.ts                # 描画処理の入口
│  │  ├─ layouts/
│  │  │  └─ default.ts          # ★ 見た目・配置を編集する主要ファイル
│  │  ├─ themes.ts              # ★ 色・余白・フォントサイズ等
│  │  └─ assets.ts              # 画像取得・SVG用埋め込み処理
│  └─ utils/
│     └─ escape-xml.ts          # XMLエスケープ
├─ fixtures/
│  ├─ playing.json              # 実データを含まない描画確認用ダミー
│  ├─ online.json
│  ├─ offline.json
│  └─ error.json
├─ test/
│  ├─ normalize.test.ts
│  └─ render.test.ts
├─ wrangler.jsonc
├─ package.json
├─ tsconfig.json
├─ .gitignore
└─ README.md
```

`src/render/` 内ではAPIを呼ばない。`src/presence/` 内ではSVGを組み立てない。`src/index.ts` にカードの座標・色・文字サイズなどを書かない。

## 4. データモデルと責務の境界

APIのレスポンス形式を描画側に直接渡さず、必ず次のような内部モデルへ正規化する。

```ts
export type PlayingStatus = 'playing' | 'online' | 'offline' | 'unknown';

export interface GamePresence {
  status: PlayingStatus;
  user: {
    name: string | null;
    avatarUrl: string | null;
  };
  game: {
    title: string;
    imageUrl: string | null;
    totalPlayTimeMinutes: number | null;
  } | null;
  fetchedAt: string; // APIを確認した時刻。実際のプレイ開始時刻ではない
}
```

各ファイルの責務：

1. `presence/providers/` は取得元ごとの API 通信を行い、取得結果を共通モデルにして返す。
2. `normalize.ts`：生JSONを`GamePresence`に変換。`friend`、`presence`、`game`などの実際の構造を、取得したサンプルとnxapiの実装に照らして確認する。未取得の値を推測して埋めない。
3. `render/card.ts`：テーマとレイアウトを選び、描画関数に正規化済みデータを渡す。
4. `render/layouts/default.ts`：カードのSVG構造・配置。描画結果は文字列として返す**純粋関数**にする。
5. `render/themes.ts`：配色・フォントサイズ・パディング・角丸などのデザイントークン。
6. `render/assets.ts`：画像が必要な場合に安全に読み込み、SVGで使える形式に変換。描画レイアウトに通信処理を持ち込まない。

描画関数の想定インターフェース：

```ts
export interface CardAssets {
  avatarDataUri: string | null;
  gameImageDataUri: string | null;
}

export interface CardTheme {
  background: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
}

export function renderDefaultCard(
  presence: GamePresence,
  assets: CardAssets,
  theme: CardTheme,
): string;
```

将来デザインを変更するときは、新しい `layouts/compact.ts` や `layouts/retro.ts` を追加し、`render/card.ts`から選べるようにする。API取得や正規化ロジックには触れない。

## 5. 表示仕様（初期デザイン）

- 横長のカード1枚。初期サイズの目安は **幅600px × 高さ180px**。数値はデザインモジュールの定数にまとめる。
- 左：ゲーム画像（存在しない場合はプレースホルダー）。右：プレイ状態、ゲーム名、必要ならプレイ時間。
- 下部の小さな領域にSwitchのユーザー名とアイコンを表示する（任意の項目は欠落してもよい）。
- 初期テーマはdarkのみ。後でテーマを増やせる構造にする。
- 文字列が長い場合は省略し、XMLをエスケープする。任意文字列をそのままSVGタグに挿入しない。
- `playing`：`NOW PLAYING` + ゲーム名／画像。
- `online`：`ONLINE` + `Not playing`。
- `offline`：`OFFLINE`。前回のゲーム名は**API上で確認できる場合に限り**表示。
- `unknown`／取得失敗：`STATUS UNAVAILABLE` と表示し、**オフラインと断定しない**。
- プレイ時間は、APIに妥当な値が存在する場合のみ表示。累計時間と現在のセッション時間を混同しない。
- `fetchedAt`を表示する場合は「最終確認時刻」と明記し、プレイ開始日時と誤認させない。

### SVGと画像の扱い

- レスポンスヘッダーは`Content-Type: image/svg+xml; charset=utf-8`。
- SVGは可能な限り自己完結させる。ゲーム画像・アバターの外部URLをSVG内の`<image href="https://...">`へ直書きしない。
- 画像は必要な場合だけWorker側で取得し、サイズ・MIMEタイプ・リダイレクト・取得先ドメインを検証して安全なデータURIとして埋め込む。想定外の場合はプレースホルダーに切り替える。
- SVG内でJavaScript、外部CSS、`foreignObject`に依存しない。
- **GitHubで実際に表示検証すること。** GitHub側のSVGサニタイズ・画像プロキシにより、一部の表現や画像埋め込み方式が使えない可能性がある。必要ならPNG配信を後から検討する。

## 6. API・設定・セキュリティ

### API

| URL | 内容 |
| --- | --- |
| `GET /card.svg` | SVGを生成して返す唯一の公開エンドポイント |
| `GET /health` | 任意。単純な稼働確認。存在するなら機密情報を返さない |

- MVPでは`/card.svg`のURLパラメータは不要。後で`?theme=dark`などを追加する場合も、決められた値だけを許可する。
- 利用者が指定した任意URLをfetchする処理は作らない（SSRF対策）。
- 外部APIエラー・タイムアウト時も、できる限りフォールバックSVGを返す。エラー詳細やAPI URLを画像・レスポンス本文に含めない。
- カードの公開URLにアクセスできる人は表示内容を見られる。公開してよいゲーム活動情報だけをカードに含める。

### 秘密情報と設定

- `NINTENDO_SESSION_TOKEN` と必要に応じた `NXAPI_AUTH_CLIENT_SECRET` は、自前方式の Worker Secret として設定する。対象の `MAIN_NSA_ID` と認証用の `NXAPI_AUTH_CLIENT_ID` も本番では Worker Secret で管理する。
- `NXAPI_PRESENCE_URL` は nxapi-auth に切り替える場合に Worker Secret として設定する。
- ローカル実行時は`.dev.vars`に同名で設定し、`.gitignore`に追加。`.dev.vars.example`にはダミーのプレースホルダーだけを記載する。
- Nintendo のパスワードは、任天堂のログイン画面に入力する。
- 外部に見せたくないプレイ情報をnxapi-auth自体が公開している可能性があるため、連携時に公開範囲を確認する。**Workerを挟んでもnxapi-auth側の公開状態は変わらない。**
- Presence URLの有効性や第三者利用条件はnxapi-auth側の仕様変更に依存する。過度なポーリングを避け、エラー時に高速リトライしない。

### キャッシュ・更新頻度

- API と画像は2分ごとに取得する。SVG は最大90秒キャッシュし、KV に保存したデータは更新時刻から10分間表示する。
- Cloudflare側のキャッシュは制御できても、**GitHubの画像プロキシ（Camo等）のキャッシュは完全には制御できない**。README上で秒単位に切り替わることは約束しない。
- GitHubでは一定時間遅れて更新される前提とし、WorkerのURLへ直接アクセスした場合に最新の状態を取得できるかを別途確認する。
- 取得失敗を`offline`に書き換えない。古い情報を表示する場合は古さが分かる形にする。

## 7. 実装手順（AIに実行させる順番）

### Phase 0 — 外部APIの確認

- [ ] サブアカウントをメインアカウントのフレンドにし、ローカルで nxapi の認証と取得を確認する。
- [ ] nxapi-auth に切り替える場合は、JSON 用の Presence URL を用意する。
- [ ] プレイ中・オフライン等でどのフィールドが存在するか確認し、内部モデルに落とし込む。
- [ ] アカウント名・ID・個人情報を削除したテスト用fixtureを用意する。

### Phase 1 — ダミーデータからカード生成

- [ ] TypeScript + Hono + Cloudflare Workers + Vitestでプロジェクトを初期化。
- [ ] `GamePresence`型、`renderDefaultCard`、テーマ定数を実装。
- [ ] `playing / online / offline / unknown` のfixtureを使い、SVGを生成。
- [ ] レイアウトは仮デザインでよい。最初から凝らない。
- [ ] ローカルでSVGが表示でき、長いタイトル／画像なしでも崩れないことを確認。

### Phase 2 — 実API接続

- [ ] 取得元の設定と Worker Secrets から API 通信を実行する。
- [ ] レスポンスの検証・正規化・フォールバック表示を実装。
- [ ] 画像URLがある場合の安全な取り込みを実装。
- [ ] カード描画が通信処理や外部APIのフィールド名に依存していないことを確認。
- [ ] 取得失敗、タイムアウト、画像取得失敗をテスト。

### Phase 3 — デプロイ・GitHub埋め込み

- [ ] Cloudflare Workersへデプロイ。
- [ ] 選んだ取得元の Worker Secrets を設定する。
- [ ] 公開された`/card.svg`をブラウザで開き、正しいSVGが返ることを確認。
- [ ] GitHubプロフィールREADMEに次の形式で埋め込む。

```md
![Nintendo Switch Activity](https://<worker-domain>/card.svg)
```

- [ ] GitHub上で画像・フォント・レイアウトが表示されることを確認。
- [ ] Switchでゲームを起動／終了し、Workerの直URLとGitHub上の反映の差を確認・記録。
- [ ] READMEにセットアップ方法、構成、デザイン変更箇所を簡潔に記載。

### Phase 4 — 後からデザインだけ変更

- [ ] `src/render/layouts/default.ts` と `src/render/themes.ts` を中心に修正。
- [ ] デザイン変更のたびに`playing / online / offline / unknown`のプレビューを確認。
- [ ] API通信・内部モデルに変更を加えずにデザインを差し替えられるか確認。
- [ ] 必要に応じて新しいレイアウトを追加する。既存レイアウトは比較用に残してよい。

## 8. テスト・完成条件

### 最低限のテスト

- `normalize`：ゲームあり／なし、欠落フィールド、未知のステータス、異常レスポンス。
- `render`：4状態すべてで有効なSVG文字列ができる。長文や`<`, `&`, `"`を含む文字列が壊れない。
- 画像：取得できない画像でカードが壊れない。許可しないURL形式・MIME・過大サイズを拒否できる。
- API：タイムアウトや5xxで無限リトライしない。`NXAPI_PRESENCE_URL`がレスポンスに漏れない。
- GitHub：READMEのSVGが実際に描画される。オンライン／オフライン遷移でレイアウトが保たれる。

### MVPの完了条件

1. 自分のGitHubプロフィールにカードが表示されている。
2. Switchでプレイすると、**Workerの直URLでは**更新後の状態が確認できる（外部APIの更新遅延は許容）。
3. オフライン・取得失敗・画像なしでも正常なSVGを返す。
4. デザインを変更するとき、原則`src/render/`だけ触ればよい。
5. 本番コード・Git履歴・ログにPresence URLや認証情報が入っていない。
6. 設定は Worker 変数と Secrets で管理し、カード表示用のデータは KV のスナップショット1件にまとめる。

## 9. AI実装エージェントへの指示

実装・公開作業は [plan2.md](plan2.md) のフェーズと検証条件に従う。デザインを変えるときは `src/render/` を起点にし、既存のプレビューで各状態を確認する。

## 10. 参考リンク

- [nxapi本体](https://github.com/samuelthomas2774/nxapi)
- [nxapi CLI・Presence APIの仕様（JSONとSVGエンドポイント）](https://github.com/samuelthomas2774/nxapi/blob/main/docs/cli.md)
- [nxapi-auth・Presence APIのセットアップガイド](https://github.com/samuelthomas2774/nxapi/discussions/155)
- [GitHub READMEへの埋め込み例](https://github.com/samuelthomas2774/nxapi-presence-embed-test)
- [Presence APIを別アプリから利用している例](https://github.com/itsfatlum/Nintendo-Switch-Presence)
- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)

---

Worker の Cron が選択した取得元から状態を取得し、HTTP が KV のデータを使ってカードを描画する。デザインは `src/render/` で変更する。GitHub 上の表示は画像プロキシのキャッシュにより遅れる場合がある。
