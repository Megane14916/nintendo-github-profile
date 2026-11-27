# Nintendo Switch GitHub Presence Card — 設計書兼実装計画

> 作成日：2026-11-26  
> 対象リポジトリ：https://github.com/Megane14916/nintendo-github-profile  
> 対象ブランチ：`main`（2026-11-26時点のコードを確認）  
> 方針：既存のSVGレンダリング実装を生かし、**Phase 1で実API連携**、**Phase 2以降でKV・Cron・本番運用**を追加する。

## 1. 目的と決定事項

普段遊んでいるNintendo Switchアカウントのオンライン状態、プレイ中のゲーム、ゲーム画像、プロフィール情報を、GitHubプロフィールREADMEに独自デザインのSVGカードとして表示する。

- サブのNintendoアカウントを使ってメインアカウントのフレンド情報を取得する。**当初は自前nxapi方式で動作させる。**
- `nxapi-auth`が提供するPresence APIを使えるようになったら、**設定の変更で取得元を切り替えられる**ようにする。
- Cloudflare Workers + Hono + TypeScriptを継続利用する。VPSやPCの常時起動、Web設定画面、一般公開の認証UI、GitHubへの定期コミットは不要。
- 最終構成では、**Workers Cron（原則2分ごと）→KV保存→`GET /card.svg`でSVG生成**とする。
- GitHub READMEには現在と同様、Workerの`/card.svg`のURLを埋め込む。GitHub側の画像キャッシュにより、2分以内の表示反映は保証しない。
- 取得元、正規化、データ保存、描画の責務を分離する。既存の`src/render/layouts/`やテーマには原則手を加えない。
- Nintendoの非公開APIを利用するため、API仕様変更・認証失敗の可能性を前提とする。認証の実現性を確認する前に保存・運用部分を作り込まない。

## 2. 現状の実装と変更範囲

### 実装済み

| 現在のファイル | 内容 | 方針 |
| --- | --- | --- |
| `src/index.ts` | Honoの`GET /card.svg`、fixture表示、URLからのPresence取得、90秒キャッシュ | Phase 1でデータ取得元を差し替え可能にする。Phase 3でKV読み出しへ変更 |
| `src/presence/nxapi.ts` | `NXAPI_PRESENCE_URL`へのHTTP取得（nxapi-auth方式） | `presence/providers/nxapi-auth.ts`へ移動・流用 |
| `src/presence/normalize.ts` | `payload.friend.presence`形式を`GamePresence`に変換 | 残す。自前方式のレスポンス差異はAdapter側で吸収 |
| `src/model/presence.ts` | `GamePresence`型 | 基本維持 |
| `src/render/card.ts` | スタイル選択・SVG生成 | 維持 |
| `src/render/layouts/`、`themes.ts`、`copy.ts` | SVGデザイン各種 | 維持 |
| `src/render/assets.ts` | 画像URL検証、ダウンロード、Data URI化 | 画像取得元の検証条件のみ必要に応じて変更 |
| `fixtures/`、`test/` | ダミー情報・描画やHTTPのテスト | 維持し、機能ごとのテストを追加 |
| `wrangler.jsonc` | Workerの設定 | Phase 2以降でKV binding・Cronを追加 |

### 未実装

1. サブアカウントの認証、短期トークン更新、Nintendoフレンド情報の取得。
2. 自前nxapi方式とnxapi-auth方式を切り替えるProvider。
3. KVへのスナップショット保存・取得。
4. Cronによる定期更新。
5. 実データを用いた本番運用・障害時の扱い。

## 3. 完成時のデータフロー

```text
【データ更新：2分ごと】
Cloudflare Workers Cron
    ↓
Presence Provider（PRESENCE_SOURCEで選択）
    ├── self       → サブアカウント認証 → NintendoフレンドAPI
    └── nxapi-auth → Presence API URLへHTTP GET
    ↓
GamePresenceへ正規化
    ↓
ゲーム画像・アバターを取得してData URI化
    ↓
PresenceSnapshot { presence, assets, refreshedAt, schemaVersion }
    ↓
Cloudflare Workers KV（キー：presence:current）

【画像表示：アクセス時】
GitHub README → GET /card.svg?style=orbit
    ↓
KVからPresenceSnapshotを読み込む
    ↓
既存のrenderCard(presence, assets, style)
    ↓
SVGを返す
```

**重要：Phase 1では上図のKV・Cronをまだ使わない。** 動作確認のため、HTTPリクエストからProviderを直接呼び、既存の`renderCard()`につなぐ。以後のPhaseでデータ取得のタイミングだけを変更する。

## 4. ディレクトリ構成（完成形）

```text
nintendo-github-profile/
├── src/
│   ├── worker.ts                     # [新規/P3] Workersのfetchとscheduledの入口
│   ├── index.ts                      # [既存/変更] Honoの/card.svgとプレビュー
│   ├── config.ts                     # [既存/変更] Bindings・定数
│   ├── nintendo/
│   │   ├── auth.ts                   # [新規/P1] サブアカウント認証・更新
│   │   └── client.ts                 # [新規/P1] フレンド情報の取得
│   ├── presence/
│   │   ├── provider.ts               # [新規/P1] 取得元選択・共通契約
│   │   ├── providers/
│   │   │   ├── self.ts               # [新規/P1] 自前nxapiからGamePresenceへ
│   │   │   └── nxapi-auth.ts         # [移動/P1] 従来のHTTP取得処理
│   │   └── normalize.ts             # [既存] 既存Presence形式の正規化
│   ├── model/
│   │   └── presence.ts              # [既存] GamePresence型
│   ├── storage/
│   │   └── presence.ts              # [新規/P2] KVの読み書き・スキーマ検証
│   ├── jobs/
│   │   └── refresh-presence.ts      # [新規/P3] Provider→画像→KV保存
│   ├── render/
│   │   ├── card.ts                  # [既存] renderCard()
│   │   ├── assets.ts                # [既存/微修正] 画像処理・安全な取得元
│   │   ├── copy.ts                  # [既存]
│   │   ├── themes.ts                # [既存]
│   │   └── layouts/                 # [既存] 全デザインを維持
│   └── utils/                        # [既存]
├── fixtures/                         # [既存]
├── test/                             # [既存+追加]
├── docs/
│   └── plan.md                       # この設計書で更新する想定
├── .dev.vars.example                 # [変更] 認証情報の名前だけ列挙
├── wrangler.jsonc                    # [変更/P2-P3]
└── package.json                      # [変更/P1] nxapi等を追加
```

**ディレクトリは段階ごとに作る。** 未着手のPhaseの空ディレクトリを先に増やす必要はない。`worker.ts`の導入後も、Honoアプリは`src/index.ts`からexportし、既存の`app.request()`テストをできるだけ維持する。

## 5. データモデルとモジュール境界

### 5.1 `GamePresence`を共通モデルとして使う

現在の`src/model/presence.ts`の構造を維持する。

```ts
export type PlayingStatus = 'playing' | 'online' | 'offline' | 'unknown';

export interface GamePresence {
  status: PlayingStatus;
  user: { name: string | null; avatarUrl: string | null };
  game: {
    title: string;
    imageUrl: string | null;
    totalPlayTimeMinutes: number | null;
  } | null;
  fetchedAt: string;
}
```

`fetchedAt`は**取得に成功した時刻**とし、プレイ開始時刻とはみなさない。`unknown`と`offline`は区別する。自前nxapiのレスポンス形式を無理に`normalize.ts`へ押し込まず、Providerごとに実データを確認してAdapterを用意する。

### 5.2 Providerの契約

```ts
export type PresenceSource = 'self' | 'nxapi-auth';

export interface PresenceProvider {
  getPresence(): Promise<GamePresence>;
}

export function createPresenceProvider(env: Bindings): PresenceProvider {
  // PRESENCE_SOURCEに応じて切り替える（実装時に具体化）
  throw new Error('Not implemented');
}
```

- `self`：認証・フレンド取得は`src/nintendo/`が担当し、`providers/self.ts`が`GamePresence`に変換する。
- `nxapi-auth`：既存の`fetchPresence()`と`normalizePresence()`を再利用する。
- 取得に失敗した場合は、オフラインに変換せず**例外または明示的な取得失敗**として上位へ伝える。HTTPの5xx、認証期限切れ、レスポンス形式変更を区別してログに残す（秘密は出さない）。
- ProviderがSVGやKVの存在を知る設計にはしない。
- 将来の切り替えは`PRESENCE_SOURCE=self` / `nxapi-auth`のみで行えることを目標とする。Providerごとの必要なSecretsは事前に設定する。

### 5.3 画像の扱い

- nxapiが返す画像URLを`src/render/assets.ts`で取得してData URI化する既存方針を継続する。
- **自前nxapiの画像URLとnxapi-authの代理画像URLは許可条件が異なる場合がある。** 取得元のホストとパスの許可リストをProviderに応じて明示し、任意URLの取得は許可しない。
- Content-Type、サイズ、HTTPS、リダイレクト禁止など既存の防御を維持する。
- 画像取得に失敗してもプレイ状態は捨てず、画像のみプレースホルダーとする。

### 5.4 KVへ保存するスナップショット（Phase 2以降）

```ts
export interface PresenceSnapshot {
  schemaVersion: 1;
  presence: GamePresence;
  assets: {
    avatarDataUri: string | null;
    gameImageDataUri: string | null;
  };
  refreshedAt: string; // Cronで最後に正常更新できた時刻
}
```

- KVキーは`presence:current`の**1キー**を基本とする。認証トークンをこのJSONに含めない。
- `refreshedAt`は毎回の正常取得で更新する。画像やステータスが変わらなくても、更新確認ができていれば保存する（無料枠に注意）。
- 失敗時は既存の正常スナップショットを上書きしない。
- `GET /card.svg`は`refreshedAt`の古さを確認し、一定時間（初期案：10分）以上更新されなければ`unknown`として描画する。**古い「プレイ中」を現在の状態として表示し続けない。**
- KVは結果整合性のため、最新状態の反映に追加の遅延があり得る。GitHubの画像キャッシュによる遅延も別に存在する。
- KVの無料枠（2026-11-26確認）：**書き込み1,000回/日**。2分ごとの正常保存は最大720回/日。認証キャッシュを別キーに頻繁に書くと枠を圧迫するので、回数を計測し必要な場合だけ保存する。

## 6. Phase 1 — 自前nxapiによる実API連携

**目的：KVやCronなしで、実際のSwitchのプレイ情報をWorkerから取得し、既存SVGに表示できることを確認する。** ここが技術的に最も不確実なため、後続Phaseに進む条件とする。

### 1-1. アカウント・認証の準備

- [ ] サブNintendoアカウントを用意し、Nintendo Switch本体のユーザーに連携する。
- [ ] メインアカウントとサブアカウントをフレンドにする。
- [ ] メインアカウントのオンライン状態と、必要ならプレイ記録をサブアカウントに公開する。
- [ ] ローカルのnxapi CLIでサブアカウントを認証し、フレンド一覧・メインアカウントのPresenceが取得できることを先に確認する。
- [ ] メインアカウントのNSA IDを確認する。**Nintendo Account ID、NSA ID、フレンドコードを混同しない。**
- [ ] nxapiライブラリから利用する認証補助サービスに、必要ならnxapi-authのOAuthクライアント登録を行う。これは**Presence APIのユーザー登録（`Set up now`）とは別の仕組み**。公式手順に従う。

ローカルCLIの確認例（コマンドの利用方法はnxapi公式ドキュメントに従う）：

```bash
nxapi nso auth
nxapi nso friends --json
nxapi nso presence --friend-nsaid <MAIN_NSA_ID>
```

### 1-2. Workers上でnxapiを使えるか検証

- [x] `nxapi`ライブラリの依存関係を確認し、Wranglerでビルドできるか検証する。
- [x] 必要なNode.js互換設定やAPIへの対応を確認する。**CLIをWorker内で実行しない。**
- [x] `src/nintendo/auth.ts`を作成し、サブアカウントの長期セッショントークンをWorkers Secretから読み込む。
- [x] 必要な短期トークンの生成・更新処理を実装する。Phase 1では永続キャッシュを必須にせず、単発の取得を通すことを優先する。
- [x] `src/nintendo/client.ts`を作成し、メインアカウントのフレンドPresenceを実際に取得する。
- [x] 実行環境の制約、Nintendo側エラー、外部認証補助サービスの失敗を切り分けられるログを用意する。

> **注意：** nxapiのnpm CLIはローカルデータ保存や認証キャッシュを備えるが、ライブラリ使用時にそれらが自動的に使えるとは限らない。さらに、ライブラリでの認証補助サービス利用にはnxapi-authのクライアント登録が必要と公式READMEに記載されている。互換性と認証は未検証のため、成功を前提にコードを作り込まない。

### 1-3. Providerと既存レンダリングへ接続

- [x] `presence/providers/self.ts`を実装し、取得した実レスポンスを`GamePresence`へ変換する。
- [x] 既存の`src/presence/nxapi.ts`を`presence/providers/nxapi-auth.ts`へ移動し、HTTP取得処理を再利用する。
- [x] `presence/provider.ts`に`PRESENCE_SOURCE`で切り替える仕組みを追加する。
- [x] `src/index.ts`の`GET /card.svg`を、指定Providerからの取得→画像取得→`renderCard()`という経路につなぐ（**Phase 1限定の直接取得**）。
- [x] 既存の`PREVIEW_STATUS`によるfixtureプレビューとデザイン切り替えを壊さない。
- [ ] 実APIで`playing`、`online`、`offline`、取得失敗を検証する。画像・プレイ時間は公開設定や取得可能性に依存するので、欠損時も成立するようにする。

### Phase 1の完了条件

2026-11-26 に nxapi `1.6.1-next.257` を使った Worker を実装した。Wrangler のビルドと、ローカルの workerd で認証・取得をモックした SVG 描画および短期トークンの更新を確認した。互換ヘッダー `X-znca-Compatible-Version: 3.5.0` 付きで nxapi の公開設定を取得できた。

2026-11-27 にローカルの Workers 環境で、サブアカウントからメインアカウントの実際の Presence を取得した。`/card.svg` でオフライン時の状態とプロフィール画像、プレイ中のゲーム名（TETRIS 99）とゲーム画像を確認した。実測したゲーム画像は585,236バイトで、ゲーム画像の取得上限を1 MiBに調整した。ゲームを起動していないオンライン状態と取得失敗時の表示は、モックで確認した。

- [x] Workersローカル開発環境から、サブアカウントでメインアカウントの実際のPresenceを取得できる。
- [x] 実際のゲーム名・ステータスが`/card.svg`に反映される。
- [x] 画像が取得できればゲーム画像とアイコンを表示でき、失敗時もSVGが壊れない。
- [x] `PRESENCE_SOURCE`の切り替えが動作する（HTTPのモックで確認）。
- [ ] 認証情報がレスポンス、SVG、ログ、Gitに漏れない。
- [x] `npm run check`と`npm test`が成功する。

**進行判定：** Worker上のnxapi利用が難しい場合は、問題を記録してこのPhaseを一旦止める。常時サーバーを増やす前に、GitHub Actionsによる5分程度の定期取得などへの切り替えを検討する。

## 7. Phase 2 — KV保存と読み出しの実装

**目的：取得結果をWorkerの実行間で共有できる形にする。Cronはまだ組み込まず、手動更新で検証する。**

- [ ] Cloudflare Workers KV名前空間を作成し、`PRESENCE_KV` bindingを`wrangler.jsonc`に追加する。
- [ ] `storage/presence.ts`を作成し、`PresenceSnapshot`の保存・取得・スキーマ検証を実装する。
- [ ] 認証情報を含めないこと、画像データ込みでKVの値サイズを超えないことを確認する。
- [ ] データが取得できたときだけ1キーを保存する。失敗時は既存データを維持する。
- [ ] 開発用の手動更新（テストコードやWranglerのローカル操作等）から保存・取得を確認する。**本番公開の無認証更新エンドポイントを作らない。**
- [ ] `src/index.ts`から読み出す経路を試験実装する。ただし移行の間はProvider直接取得のテストも残す。
- [ ] KVが空、データが壊れている、データが古い場合の表示をテストする。

### Phase 2の完了条件

- [ ] `GamePresence + CardAssets`を1つのスナップショットとして保存・読み出しできる。
- [ ] SVGはKVを読んだ情報から生成でき、Nintendo APIへ再接続しなくても表示できる。
- [ ] 取得失敗時の既存データ保持と、古いデータの`unknown`表示が動く。

## 8. Phase 3 — Cronによる2分間隔の自動更新

**目的：データ更新とHTTP表示を分離し、ユーザーがアクセスしなくても定期的に最新状態を保存する。**

- [ ] `jobs/refresh-presence.ts`にProvider取得→正規化→画像取得→KV保存の処理を集約する。
- [ ] `worker.ts`に`fetch`と`scheduled`を追加し、既存Honoアプリを`fetch`から呼ぶ。
- [ ] `wrangler.jsonc`の`main`を`src/worker.ts`に変更する。
- [ ] `wrangler.jsonc`に`"triggers": { "crons": ["*/2 * * * *"] }`を追加する。CronはUTC基準で動く。
- [ ] `GET /card.svg`はKVを読み、デザインを選んでSVGを返すだけにする。**HTTPアクセス時にはNintendo認証を実行しない。**
- [ ] 取得成功・失敗、KV読み書き、欠損画像、連続失敗時の挙動を確認する。
- [ ] Cronの重複・遅延実行があっても、同じ1キーに無駄な並列更新をしないようにする。必要になった場合のみ制御を追加する。
- [ ] KVの無料枠とWorkersのCPU時間・サブリクエスト制限を計測する。無料枠で厳しければ頻度を調整する。

入口のイメージ：

```ts
// src/worker.ts（概念例。Bindingsなどの型は実装時に調整）
import app from './index';
import { refreshPresence } from './jobs/refresh-presence';

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  scheduled(_event, env, ctx) {
    ctx.waitUntil(refreshPresence(env));
  },
} satisfies ExportedHandler<Bindings>;
```

### Phase 3の完了条件

- [ ] 本番環境で2分間隔の定期取得・KV更新が継続する。
- [ ] GitHubからの画像アクセスがなくてもKVが更新される。
- [ ] `/card.svg?style=...`がKVの同じデータから各デザインを描画できる。
- [ ] エラーがあっても無限リトライせず、秘密情報を出力しない。

## 9. Phase 4 — 本番公開・切り替え・運用

**目的：GitHubプロフィールで利用できる状態にし、将来nxapi-auth方式に切り替えられることを確認する。**

- [ ] Workers Secretsを本番環境に設定する。秘密情報を`wrangler.jsonc`、`.dev.vars.example`、GitHubに書かない。
- [ ] `PRESENCE_SOURCE=self`で公開し、実際のSwitchのプレイ開始・終了時の表示を確認する。
- [ ] GitHubプロフィールREADMEに `![Nintendo Switch Activity](https://<worker-domain>/card.svg?style=...)` を埋め込む。
- [ ] Worker直URLとGitHub READMEのキャッシュ差を確認する。
- [ ] `PRESENCE_SOURCE=nxapi-auth`に切り替えるテストを行う。サービス登録がまだできない場合はモックを使い、利用できるようになった時点で実接続を確認する。
- [ ] 認証期限切れ、API障害、KV障害、Cron実行失敗時に何が表示されるかREADMEに簡潔に記載する。
- [ ] 必要なら取得失敗の連続回数・最終正常更新時刻をログで確認できるようにする。ただしアラートやDBは現段階では増やさない。
- [ ] 現状の`docs/plan.md`とREADMEの「nxapi-authが前提」の記述を新構成へ更新する。

### Phase 4の完了条件

- [ ] GitHubプロフィールに実データを使ったカードが表示される。
- [ ] 認証・取得方式を変えてもSVG生成・KV保存・README側を変更しなくて済む。
- [ ] 既存のレイアウト、色、フォント、表示文言を自由に変更できる。
- [ ] 利用者が本番のNintendo認証情報を直接見ることはできない。

## 10. 環境変数・Secretsの方針

| 名前（案） | 用途 | 管理方法 |
| --- | --- | --- |
| `PRESENCE_SOURCE` | `self` / `nxapi-auth` | 通常のWorker変数 |
| `MAIN_NSA_ID` | 取得対象のメインアカウントのNSA ID | Worker変数。公開範囲に注意 |
| `NINTENDO_SESSION_TOKEN` | サブアカウントの長期セッショントークン | **Workers Secret** |
| `NXAPI_AUTH_CLIENT_ID` | nxapi認証補助用OAuthクライアント識別子 | 必要に応じてWorker変数 |
| `NXAPI_AUTH_CLIENT_SECRET` | クライアントのSecretが必要な場合 | **Workers Secret** |
| `NXAPI_PRESENCE_URL` | nxapi-auth方式のJSON取得先 | **Workers Secret** |
| `PRESENCE_KV` | スナップショット保存用binding | KV binding |
| `PREVIEW_STATUS` | fixtureプレビュー | 開発用Worker変数 |

実際に必要なクライアント認証の入力項目は、採用するnxapiバージョンのAPIに合わせて確定する。**Nintendoパスワードは保存しない。** トークンの出力、Gitへのコミット、ログへの記録は禁止する。以前に露出したトークンがあれば失効・再発行する。

## 11. テスト方針

| 対象 | 追加するテスト |
| --- | --- |
| Provider | `self` / `nxapi-auth`切り替え、正常取得、レスポンス不正、APIエラー |
| 正規化 | `playing` / `online` / `offline` / `unknown`、フィールド欠損、プレイ時間、画像URL |
| 認証 | トークン期限切れ、更新失敗、外部認証補助APIのエラー（秘密をマスク） |
| 画像 | 許可ホスト、MIME、サイズ、リダイレクト、画像なし |
| KV | 保存→読み出し、空、破損、古いデータ、取得失敗時の旧データ保持 |
| Cron | 正常時のみ保存、例外発生、繰り返し実行、更新時刻の記録 |
| HTTP | `/card.svg`のSVG MIME、全style、GitHub表示、KV読み込みのみでAPI未呼び出し |

既存テストを削除して新構成に合わせるのではなく、fixtureベースのレンダリングテストを維持し、Provider・KV・Cronごとに追加する。外部サービスへの実接続はユニットテストで行わず、明示したローカル検証と本番検証に分ける。

## 12. この段階では実装しないもの

- Web設定画面、ユーザー登録、複数人向けサービス、DB、認証UI。
- Nintendoアカウントのパスワードを自動入力する仕組み。
- GitHub APIでSVGをコミットする仕組み。
- 過去のゲーム履歴や日別プレイ時間の分析。Presence APIから得られない履歴を推測で作らない。
- フォールバックのための自動Provider切り替え。まずは明示的な設定変更に限定する。
- 永続的なLinuxサーバーやContainers。Workers互換性が確認できなかった場合にのみ代替を評価する。

## 13. 進捗チェックリスト

- [x] 既存のfixtureからSVGを生成できる
- [x] デザインの切り替えとSVG描画テストがある
- [x] nxapi-auth形式JSONのHTTP取得コードがある（実アカウント未接続）
- [x] **Phase 1**：自前nxapi認証・実APIからのフレンド情報取得・既存SVG表示
- [ ] **Phase 2**：KVのスナップショット保存・読み出し
- [ ] **Phase 3**：2分CronとKVベースのHTTP表示
- [ ] **Phase 4**：GitHub READMEでの本番表示・nxapi-auth切り替え検証

---

## 参考資料

- 現在のリポジトリ：https://github.com/Megane14916/nintendo-github-profile
- nxapi公式README：https://github.com/samuelthomas2774/nxapi
- nxapi CLI：https://github.com/samuelthomas2774/nxapi/blob/main/docs/cli.md
- nxapiのライブラリAPI：https://github.com/samuelthomas2774/nxapi/blob/main/docs/lib/index.md
- Cloudflare Cron Triggers：https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare Workers KV：https://developers.cloudflare.com/kv/
- Cloudflare Workers KVの価格・無料枠：https://developers.cloudflare.com/kv/platform/pricing/
- Cloudflare Workers KVの制限：https://developers.cloudflare.com/kv/platform/limits/

> **開発上の最優先事項：まずPhase 1を完了すること。** Nintendo認証とnxapiのWorkers互換性を確かめる前にKV・Cronの詳細を作り込まない。実データが`GamePresence`になり、既存の`renderCard()`へ渡せることを確認してから順に進める。
