<div align="center">

# Rental Helper

### 候補を比べて、自分に大切な条件を見つける。

物件の画像・掲載リンクから、根拠のある比較、希望を整理する対話、相談に使えるメモへ。

[**デモ動画を見る**](https://sodashikenn.github.io/rental-helper/demo/) · [**アプリを試す**](https://sodashikenn.github.io/rental-helper/) · [**実装を読む**](docs/CODE_TOUR.md)

[English](README.md) · [プロダクト設計](PRODUCT.md) · [ロードマップ](ROADMAP.md)

[![Tests](https://github.com/SodaShikenn/rental-helper/actions/workflows/ci.yml/badge.svg)](https://github.com/SodaShikenn/rental-helper/actions/workflows/ci.yml)
[![Pages](https://github.com/SodaShikenn/rental-helper/actions/workflows/pages.yml/badge.svg)](https://github.com/SodaShikenn/rental-helper/actions/workflows/pages.yml)

[![Rental Helperの操作デモを再生：候補比較から希望の確認、条件メモの出力まで](web/demo/media/poster.jpg)](https://sodashikenn.github.io/rental-helper/demo/)

**[▶ チャプター付きで再生](https://sodashikenn.github.io/rental-helper/demo/)** · [MP4をダウンロード](https://sodashikenn.github.io/rental-helper/demo/media/walkthrough.mp4) · [日英の字幕テキスト](web/demo/media/transcript.md)

</div>

> **動画について：** 実際の画面を操作したシミュレーションです。物件情報は記録済みの例、AI応答は録画専用の固定データです。動画内でも常時明示しています。比較・希望の確認・地図リンク生成・HTML出力は実装済みの機能を操作しています。リアルタイムのAI品質や現在の募集状況を示すものではありません。[再録画の方法](docs/DEMO.md)

## 解決したいこと

「気になる物件はある。でも、何を優先して決めればよいか分からない。」

Rental Helperは、最初に暮らしの希望を書いてもらうのではなく、**候補の違いから質問を作る**ツールです。出典付きの事実を比較し、不明点を残したまま、利用者が確認した希望だけを判断材料にします。

**候補 → 根拠 → 具体的な質問 → 本人の確認 → 納得できる判断**を一つの流れにしています。

## 採用担当者・レビュー担当者の方へ

| 見る時間 | おすすめの入口 |
| --- | --- |
| **約90秒** | [動画で一連の体験を見る](https://sodashikenn.github.io/rental-helper/demo/)。音声なしでも理解でき、日本語字幕に切り替えられます。 |
| **3分** | [公開デモ](https://sodashikenn.github.io/rental-helper/)で金額の根拠を開き、数値の質問に答えて、メモを出力。アカウント・APIキーは不要です。 |
| **10分** | [コードツアー](docs/CODE_TOUR.md)から機能単位の設計とテストを確認し、[検証記録](docs/VALIDATION.md)で実測との境界を見る。 |

### 動画の見どころ

| チャプター | 確認できる設計 |
| --- | --- |
| [01 候補を比較](https://sodashikenn.github.io/rental-helper/demo/#chapter=0) | 画像・掲載値・不足情報を同じ画面に整理。 |
| [02 参考価格の根拠](https://sodashikenn.github.io/rental-helper/demo/#chapter=1) | 別室の募集価格を、その候補の確定賃料として扱わない。 |
| [03 候補から質問](https://sodashikenn.github.io/rental-helper/demo/#chapter=2) | 固定応答によるAI対話の例。自由記述の要望フォームから始めない。 |
| [04 解釈を確認](https://sodashikenn.github.io/rental-helper/demo/#chapter=3) | 仮の回答だけでは希望を保存せず、明示的な承認を待つ。 |
| [05 通勤を調べる](https://sodashikenn.github.io/rental-helper/demo/#chapter=4) | 主な通勤先を選び、起終点入力済みのGoogle Mapsリンクへ。 |
| [06–07 メモと出力](https://sodashikenn.github.io/rental-helper/demo/#chapter=5) | 確認した希望から自動生成し、共有内容を見てHTML保存。 |

<details>
<summary><strong>短いアニメーションで見る</strong></summary>

[![候補比較と根拠確認の短い操作プレビュー](web/demo/media/preview.gif)](https://sodashikenn.github.io/rental-helper/demo/)

[再生・停止・字幕・チャプターを使って動画を見る →](https://sodashikenn.github.io/rental-helper/demo/)

</details>

## 3つの操作で体験する

1. **比べる。** 「候補比較」で月額をクリックして内訳と出典を確認。GRAN PASEO明大前Ⅳの参考価格は別室の募集なので、確定予算には含めません。
2. **希望を見つける。** 「費用 → 比較から選ぶ」で候補に基づく目安と重要度を確認。API接続時は「AI 分析」で対話できます。公開アプリに動画用の固定AI応答は組み込んでいません。
3. **持ち出す。** 「条件メモ → 共有・出力」で自動生成された内容を見てHTML保存。メモは読み取り専用で、希望の変更は候補に基づく選択から行います。

PCは上部タブ、スマートフォンは「機能を選ぶ」から移動できます。

## 現在の機能

| 機能 | できること | 公開デモでの動作 |
| --- | --- | --- |
| 候補比較 | 画像・リンクの追加、費用・広さ・出典の比較、不足賃料の自動調査 | 記録済み候補と数値の質問は利用可。抽出・調査はAPIが必要。 |
| 通勤 | 主要8駅・任意の目的地、各候補の行き／帰りの地図リンク | API不要。起終点・移動方法を渡し、日時はMaps側で設定。結果の自動取得はしません。 |
| 駅・買い物 | 掲載の徒歩時間とMapsの観測を照合 | APIが必要。掲載情報と取得結果を区別。 |
| 余暇 | 公園・ジム・カフェを調べ、関心・頻度・重要度を確認 | APIが必要。場所を見てから希望を考える。 |
| 口コミ分析 | 部屋 → 同じ建物 → 近隣の順に公開口コミを調査 | APIが必要。近隣の声を当該物件に当てはめず、見つからなければ空欄。 |
| 暮らしの試算 | 既知の費用、確認した余暇の希望、週の想定を比較 | 未取得の通勤時間や総合スコアは作らない。 |
| 条件メモ | 確認した希望・次に聞くことを自動生成 | 表示・コピー・端末内保存に対応。手入力の内見日記はありません。 |
| 共有・出力 | 内容のプレビュー、HTML保存、期限付き共有・削除 | HTMLは利用可。共有リンクはバックエンドが必要。 |

## 実装で示す取り組み

| 設計判断 | 理由 | コード |
| --- | --- | --- |
| **本人が確認してから反映** | AIの解釈と利用者の希望を分ける。 | [Advisor](web/apps/advisor/)・[テスト](web/tests/apps/advisor/) |
| **不明・別室・近隣を区別** | 根拠の範囲を超えて情報を埋めない。 | [価格調査](server/apps/research/)・[口コミ探索](server/apps/reviews/fallback.py) |
| **提供元の制約に対応** | 日本の公共交通API制限を、入力済みのMapsリンクで補う。 | [URL生成](web/apps/commute/links.js)・[テスト](web/tests/apps/commute/links.test.js) |
| **機能ごとに分割** | UI、純粋な変換処理、外部APIを独立して読む・検証する。 | [コードツアー](docs/CODE_TOUR.md) |
| **共有する内容を限定** | 一時的な地図情報や口コミ本文を保存・出力しない。 | [共有機能](server/apps/sharing/) |
| **再現可能な検証** | スタブによる動作確認と実接続の成功を混同しない。 | [検証記録](docs/VALIDATION.md)・[録画スクリプト](scripts/record-demo.mjs) |

**技術構成：** JavaScript ES Modules / HTML / CSS、FastAPI / Pydantic、Gemini、Docling / RapidOCR、Google Maps、IndexedDB、SQLite、Docker、GitHub Actions。フロントエンドはビルド不要です。

<details>
<summary><strong>ローカルで動かす・テストする</strong></summary>

```bash
npm run dev:web
# http://127.0.0.1:4173/
```

記録済み候補、数値の質問、通勤リンク、HTML出力はAPIキーなしで利用できます。開発コマンドにはNode.js 22+とPython 3を使います。[バックエンドの起動方法](docs/DEVELOPMENT.md#run-the-backend)

```bash
npm ci
npm run test:web
npm test                # バックエンドのテスト依存を導入した後
npm run smoke:ui        # Webサーバー起動中
npm run smoke:browser   # Web/APIサーバー起動中
```

[動画を再生成する](docs/DEMO.md) · [設定・デプロイ](docs/DEVELOPMENT.md)

</details>

## 検証状況と次の開発

**開発中のプロトタイプ・2026年9月22日。** 241テスト成功（フロント111・サーバー130）、実OCRの任意2テストはスキップ。PC・スマートフォンのブラウザチェックとCIを通過しています。これは実装の検証であり、AI精度や利用者への効果を実証した数字ではありません。

公開サイトはフロントエンドと動画を配信します。実際の抽出・調査・AI対話・徒歩確認・口コミ取得・リンク共有には、別途公開APIが必要です。直近のGemini実接続では混雑エラーがあり、口コミの実取得と対象範囲も継続検証中です。通勤リンクは公開デモで利用できますが、アプリ内の日本の公共交通時間比較には別の提供元が必要です。

次は、利用者による使いやすさの評価、実AI・口コミの検証、共有データを永続化できるバックエンド公開です。[ロードマップと受け入れ条件 →](ROADMAP.md)
