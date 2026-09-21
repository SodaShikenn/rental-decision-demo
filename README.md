# NEST — 暮らし方から選ぶ賃貸意思決定デモ

[日本語](README.md) | [English](README.en.md)

**[▶ Live Demoを開く](https://sodashikenn.github.io/rental-decision-demo/)**

![NEST のデモ画面](assets/demo.png)

NESTは、家賃・間取り・駅徒歩だけでは比較しにくい賃貸候補を、利用者の日常動線、優先順位、妥協条件に照らして整理するフロントエンド・プロトタイプです。

目的は「最も点数の高い物件」を一方的に提示することではありません。なぜその候補が合うのか、何を妥協するのか、次に何を確認すべきかを、利用者が追える形で示します。

## デモで確認できること

- PNG／JPEG／WEBPの募集図面をアップロードし、ブラウザ内でプレビュー
- 解析サーバー（Cloudflare Worker + Claude）を設定すると、物件名、賃料、住所、最寄駅、間取り、面積、竣工年を画像から読み取り、項目ごとの信頼度、原文、画像内の根拠領域を表示
- 信頼度の低い項目、読み取れなかった項目、図面内の不一致（例：概要と間取り図の面積差）を「要確認」とし、人が原本と照合するまで候補に追加できない
- 未取得の経路・周辺情報を明示したうえで、画像の物件を暫定候補へ追加し、抽出方法・時刻・人による修正を出典として記録
- 月額予算と「譲れない条件」から候補を再順位付け
- 通勤、夜の買い物、静けさ、作業空間を生活視点で比較
- 候補ごとの適合理由、トレードオフ、内見時の確認事項を表示
- 掲載賃料の推移と居住者レビューを候補に連動して表示
- 「家賃を1万円下げるなら？」などの問いに、妥協点を対話形式で回答
- Google Maps JavaScript APIキーを設定した場合の地図表示

### 実装済み／模擬／未実装の区別

|機能|状態|
|---|---|
|募集図面の読み取り|**実装済み（解析サーバー設定時）**。`server/` のCloudflare Workerが `claude-opus-5` で読み取り、信頼度・原文・根拠領域を返す。信頼度はモデルの自己申告で、較正はしていない|
|公開デモ（GitHub Pages）の読み取り|**固定サンプル値**。`web/env.js` の `extractionApiUrl` が空のため、画像は外部送信せず、表示値も画像とは無関係|
|解析サーバーのモックモード|**テスト用の固定応答**（架空の図面 `server/tests/fixtures/listing-sheet.png` に対応）。画面上は MOCK と表示|
|物件、経路、掲載賃料、レビュー、施設評価|**架空のデモデータ**|
|チャット|**ルールベース**（LLMではない）|
|Routes / Places / Geocoding、データ保存|**未実装**。再読み込みでデータは消える|

解析サーバーを使う場合、画像はブラウザで縮小してからWorker経由でAnthropic社のClaude APIへ送信します。Workerは画像を保存せず、リクエスト中のメモリでのみ扱います（Anthropic社のAPIデータ取扱方針が適用されます）。画面上でも送信前にこの点を表示します。

## ローカルで起動する

フロントエンド（`web/`）はビルド不要の静的ファイルで、依存パッケージはありません。コマンドはリポジトリ直下で実行します（Node.js 22以上、Python 3）。

```bash
npm run dev:web          # http://localhost:4173 （web/ を配信）
npm ci --prefix server   # 初回のみ：サーバーの依存パッケージ
npm test                 # フロントエンドとサーバーの単体テスト
```

`index.html` を `file://` で直接開かず、上記のURLを使います。この状態では募集図面の読み取りは固定サンプル値です。

GitHub Pagesへは、`main` へのpush時にGitHub Actions（`.github/workflows/pages.yml`）がテストを実行してから `web/` だけを公開します。

## 画像解析サーバー（server/）

`POST /api/extract-listing`（`multipart/form-data`、フィールド名 `image`）を提供するCloudflare Workerです。

```bash
cp server/.dev.vars.example server/.dev.vars   # 既定は EXTRACTION_MODE=mock（APIキー不要・課金なし）
npm run dev:server                              # http://localhost:8787
npm run smoke                                   # 架空の図面を送り、正解値と照合
```

フロントエンドから使うには、ローカルの `web/env.js` で `extractionApiUrl: "http://localhost:8787"` を設定します（コミットしない）。実際にClaudeで読み取る場合は、`server/.dev.vars` を `EXTRACTION_MODE=live` にして `ANTHROPIC_API_KEY` を設定します。1回の読み取りごとに課金されます。

デプロイ：

```bash
cd server
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```

デプロイ後のURLを `web/env.js` の `extractionApiUrl` に設定すると、公開デモからも読み取りが有効になります。有料APIを公開することになるため、設定するかどうかは利用状況とコストを踏まえて判断してください。

**応答の形式**：`fields` の各項目は `value`（読み取れない場合は `null`）、`confidence`（0〜1、モデルの自己申告）、`evidence`（画像に対する正規化済み `[x, y, 幅, 高さ]`）、`sourceText`（図面上の原文）を持ちます。`warnings` は図面内の不一致や判読困難な箇所を示し、`meta` に抽出モード、モデル、抽出時刻を含みます。

**安全策とコスト管理**：

- APIキーはWorkerのシークレットにのみ保存し、ブラウザには出さない
- 形式は拡張子ではなくファイル先頭のバイト列で判定（PNG／JPEG／WEBP、5MBまで）
- 画像はClaudeが縮小せずに扱える上限（長辺2576px、4784ビジュアルトークン）内に収め、APIにも縮小を禁止する指定（`oversized_image: "error"`）を付けて、根拠領域の座標がずれないようにする
- 許可したオリジンのみCORSを返し、IPごとに毎分5回までに制限。`max_tokens`、60秒のタイムアウト、停止スイッチ（`EXTRACTION_ENABLED=false`）を設定
- ログには文書ID、処理時間、トークン数だけを残し、画像や読み取り値は記録しない
- 安全上の理由でモデルが応答を拒否した場合に備え、サーバー側フォールバック（`fallbacks: "default"`）を有効化
- Anthropic Consoleで利用上限（spend limit）を設定することを推奨

費用の目安（未実測）：1回あたり入力約5千トークン（画像約3千を含む）と出力数千トークンで、おおよそ0.05〜0.15米ドルです。

## 環境変数とAPIキー

将来のサーバー側連携用に、次のコマンドでローカル環境ファイルを準備できます。

```bash
cp .env.example .env
```

フロントエンドは `.env` を読み込みません。Routes、Places、物件データ、チャット用LLMなどを今後サーバー側に接続する際の受け皿として用意しています。画像解析サーバーの秘密情報は、ローカルでは `server/.dev.vars`、本番では `wrangler secret put` で設定します（どちらもGit管理対象外）。

公開デモの `web/env.js` には空のキーと空の `extractionApiUrl` だけを置いています。このファイルはサイトと一緒に公開されるため、秘密情報は置きません。地図表示をローカルで試す場合は、HTTPリファラーと利用APIを制限したブラウザ用キーを一時的に設定し、実キーをコミットしないでください。

## 実サービスに必要な連携

|目的|候補となる連携|設計上の要点|
|---|---|---|
|物件情報|契約・再利用許諾を得た物件データ|物件ID、掲載時点、住所、賃料、間取りを追跡する|
|募集図面の構造化|Cloudflare Worker + Claude（**実装済み**、`server/`）|画像を一時処理し、フィールド単位の信頼度と根拠領域を返して人が確定する|
|住所・目的地の座標化|Geocoding API|住所またはPlace IDを座標へ変換する|
|地図表示|Maps JavaScript API|ブラウザ用キーにHTTPリファラー制限とAPI制限を適用する|
|通勤・日常動線|Routes API|候補×目的地を `computeRouteMatrix` で比較し、曜日、時刻、交通手段を根拠として保存する|
|周辺施設|Places API (New)|利用者が選んだカテゴリ、距離、営業時間に絞り、必要なフィールドだけ取得する|
|賃料履歴・レビュー|再利用許諾済みのデータ提供元|掲載賃料と成約賃料を区別し、取得日と出典を表示する|

第三者の不動産サイトや口コミサイトを無断でスクレイピングする設計ではありません。住所、勤務先、帰宅時間などは入力を任意とし、保存期間と利用目的を明示する必要があります。

公式資料： [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/get-api-key) / [Routes API](https://developers.google.com/maps/documentation/routes) / [Places API (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search) / [Geocoding API](https://developers.google.com/maps/documentation/geocoding)

## 設計で重視した点

1. **必要条件を先に聞く** — 予算や通勤可能時間など、候補から外す境界を明確にする。
2. **優先順位を絞る** — 「譲れない条件」を最大2件にし、比較軸の過剰な増加を防ぐ。
3. **妥協を具体化する** — 家賃差を通勤時間などの生活上の変化へ変換する。
4. **根拠を分離する** — 適合理由、データ、注意点を分け、ランキングを検証可能にする。
5. **データの限界を示す** — デモデータ、掲載賃料、実取引、主観レビューを混同しない。

## 構成

フロントエンド（`web/`）と解析サーバー（`server/`）を分け、どちらも [LLM-RAG_KBQA](https://github.com/SodaShikenn/LLM-RAG_KBQA) と同じ方針で構成しています。起点の `app.js` が拡張機能（`extensions/ext_*.js`）を初期化して機能ごとのアプリ（`apps/<name>/`）を登録し、設定は `config.js`、共通関数は `helper.js` にまとめます。

```text
.
├── package.json              # 開発・テスト用コマンド（依存パッケージなし）
├── .github/workflows/        # テスト（ci.yml）とGitHub Pagesへの公開（pages.yml）
├── assets/demo.png           # README用プレビュー（架空の図面を使用）
├── web/                      # フロントエンド（静的ファイル、GitHub Pagesで公開）
│   ├── index.html            # 画面構造
│   ├── app.js                # 起点：拡張機能の初期化と各アプリの登録
│   ├── config.js             # 設定値（env.js の値を読み込む）
│   ├── env.js                # 公開環境ごとの値（Mapsキー、解析サーバーURL。秘密情報は置かない）
│   ├── helper.js             # 共通関数（金額表示、エスケープなど）
│   ├── extensions/           # ext_store（状態と変更イベント）、ext_google_maps
│   ├── apps/
│   │   ├── shortlist/        # 生活条件、候補の順位付け、地図ピン
│   │   ├── insights/         # 選択候補の根拠、賃料推移、レビュー
│   │   ├── chat/             # ルールベースの分析チャット
│   │   └── intake/           # 募集図面の取り込みと読み取り結果の確認
│   ├── static/               # CSS、ファビコン
│   └── tests/                # 単体テスト（node:test）
└── server/                   # 画像解析サーバー（Cloudflare Worker）
    ├── wrangler.jsonc        # Worker設定（レート制限、許可オリジン、モード）
    ├── src/
    │   ├── index.js          # Workerの入口
    │   ├── app.js            # 起点：拡張機能の初期化、ブループリント登録、共通のCORS・エラー処理・ログ
    │   ├── config.js         # 設定値（モデル、上限値、環境変数の読み込み）
    │   ├── helper.js         # 共通関数（AppError、JSON応答）
    │   ├── extensions/       # ext_anthropic、ext_cors、ext_logger、ext_rate_limit
    │   └── apps/listing/     # 募集図面の読み取りAPI
    │       ├── index.js      # ルートと前処理（停止スイッチ、レート制限）
    │       ├── views.js      # リクエスト処理
    │       ├── forms.js      # 画像の検証
    │       ├── services.js   # Claude呼び出し
    │       ├── prompts.js    # プロンプト
    │       ├── models.js     # 応答スキーマと公開形式への変換
    │       └── mock.js       # モック応答
    ├── commands/smoke.js     # 正解値との照合コマンド
    └── tests/                # 単体テストと架空の図面フィクスチャ
```

各アプリのファイルの役割は共通です。

- `index.js`：アプリの登録
- `views.js`：画面（またはHTTP）の処理
- `services.js`：画面に依存しないロジック（単体テストの対象）
- `models.js`：データ定義

### 機能を追加するには

- **フロントエンド**：`web/apps/<name>/index.js` に `initApp(app)` を定義し、`web/app.js` の `APPS` に追加します。状態は `app.extensions.store` から読み、変更は `store.on("change", ...)` で受け取ります。
- **サーバーのAPI**：`server/src/apps/<name>/index.js` で `bp`（`prefix`、`routes`、`beforeRequest`）を定義し、`server/src/app.js` の `BLUEPRINTS` に追加します。
- **外部サービス**：`extensions/ext_<name>.js` に `initApp(app)` を定義し、`app.js` の `initializeExtensions` に追加します。テストでは `createApp(env, { <name>: stub })` のように差し替えます。
- **設定値**：固定値は `config.js`、環境ごとの値はブラウザなら `web/env.js`、サーバーなら `wrangler.jsonc` とWorkerのシークレットに置きます。

## 検証済みの操作

- 条件変更後の再順位付け
- 画像アップロード、プレビュー、サンプル抽出、暫定候補追加
- 解析サーバー（モックモード）経由の読み取り、信頼度・根拠領域の表示、要確認項目の照合、出典の記録
- 解析サーバーのエラー、接続失敗、不正な応答時の表示と、明示的なサンプル値への切り替え
- 賃料が未取得の候補を予算内として扱わない（中立値で暫定評価）
- 候補選択に連動する理由、賃料推移、レビューの更新
- 妥協条件に対するチャット応答（入力文字列はHTMLとして解釈しない）
- デスクトップ／モバイル向けレスポンシブ表示
- 単体テスト（`npm test`）：スコア計算、画像の縮小規則、要確認の判定、出典表示、チャット応答、サーバーの検証・Claude呼び出し・ルーティング
- APIキー未設定時のデモ用マップへのフォールバック

## 今後の拡張

- Routes APIによる曜日・時間帯・交通手段別の移動時間比較
- Places APIによるスーパー、医療、保育、飲食店などの生活圏評価
- 許諾済み物件データと掲載賃料履歴への置換
- 確認済み候補の保存と、バージョン付き物件スキーマ
- 根拠データを引用するLLMチャットと、内見後フィードバックの学習
