<div align="center">

# Rental Helper

### 候補を比べて、自分に大切な条件を見つける。

検討中の物件から、出典付きの比較、具体的な質問、<br>
本人が確認した希望をまとめた相談メモへ。

[**デプロイ手順**](docs/DEPLOYMENT.md) · [**操作動画を見る ↗**](https://sodashikenn.github.io/rental-helper/demo/) · [**English**](README.md)

[![Tests](https://github.com/SodaShikenn/rental-helper/actions/workflows/ci.yml/badge.svg)](https://github.com/SodaShikenn/rental-helper/actions/workflows/ci.yml)

[![候補比較・根拠の確認・希望の整理を動画で見る](web/demo/media/poster.jpg)](https://sodashikenn.github.io/rental-helper/demo/)

**最新の操作フロー・Gemini / Maps実接続・ローカル収録** · [日本語 / 英語字幕](https://sodashikenn.github.io/rental-helper/demo/) · [字幕テキスト](web/demo/media/transcript.md)

</div>

> 動画はローカル環境から実際のAPIを呼び出した記録です。全機能を利用するには[デプロイ手順](docs/DEPLOYMENT.md)または[ローカル起動方法](docs/DEVELOPMENT.md)を参照してください。GitHub Pagesでは動画のみを公開しています。

## 解決したいこと

「気になる物件は3つある。でも、何を優先して決めればよいか分からない。」

賃料、間取り、立地の情報は画像や複数のサイトに分散しています。費用・通勤・普段の暮らしを気にしていても、優先順位は最初から明確とは限りません。Rental Helperは候補の違いを調べ、具体的な質問を提示します。**本人が確認した希望だけを、比較や相談メモに反映します。**

最初に希望を書くフォームや、理由の分からない総合スコアはありません。

## 操作の流れ

1. **候補を追加。** 図面や掲載リンクを取り込み、出典を確認して不足情報を調査します。
2. **大切な条件を見つける。** 候補に基づく質問に答え、AIの解釈を自分で確認します。
3. **暮らしを比較。** 徒歩・通勤リンク・余暇・口コミを調べ、条件メモを保存または共有します。

**動画の見どころ：** [画像追加](https://sodashikenn.github.io/rental-helper/demo/#chapter=1) · [リンク調査](https://sodashikenn.github.io/rental-helper/demo/#chapter=2) · [AI対話](https://sodashikenn.github.io/rental-helper/demo/#chapter=4) · [通勤](https://sodashikenn.github.io/rental-helper/demo/#chapter=5) · [口コミ](https://sodashikenn.github.io/rental-helper/demo/#chapter=8) · [出力と共有](https://sodashikenn.github.io/rental-helper/demo/#chapter=11)

<details>
<summary><strong>8つの画面でできること</strong></summary>

| 画面 | 利用者をどう助けるか |
| --- | --- |
| **候補比較** | 画像・リンクを追加し、費用・広さ・出典を比較。不足する月額費用を調査。 |
| **通勤** | 主要駅や目的地を選ぶと、行き・帰りのMapsリンクを準備。朝8時到着・夕18時出発の日時はMaps側で設定。 |
| **駅・買い物** | 掲載の徒歩時間をMapsの経路目安と照合し、周辺の買い物先を確認。 |
| **余暇** | 公園・ジム・カフェを見てから、関心と頻度を確認。 |
| **口コミ分析** | 部屋 → 同じ建物 → 近隣の順で検索。どの建物の声かを明示し、見つからなければ空欄。 |
| **暮らしの試算** | 週の想定に応じて、既知の費用と確認済みの関心を比較。未取得の通勤時間は補わない。 |
| **条件メモ** | 確認した希望と不動産会社に聞くことを自動生成。手入力の日記は不要。 |
| **共有・出力** | 内容を確認してHTML保存。API接続時は期限付きリンクの作成・取り消しにも対応。 |

PCはタブ、スマートフォンはグループ付きメニューで同じ8画面に移動できます。画像・リンクの調査、AI、地図の取得、口コミ、共有リンクにはバックエンドが必要です。画面を開くだけでは希望を保存しません。

</details>

## 設計と実装

[コードツアー](docs/CODE_TOUR.md)では、画面操作から判断ロジック、外部APIまでを機能ごとにたどれます。各設計判断に対応する実装とテストをまとめています。

| 設計判断 | 実装の入口 |
| --- | --- |
| AIの解釈には根拠と本人の確認が必要 | [回答検証](server/apps/advisor/services.py)・[テスト](server/tests/apps/advisor/test_advisor.py) |
| 別室の賃料を候補の確定値にしない | [物件照合](server/apps/research/services.py)・[自動補完の条件](web/apps/research/monthly.js) |
| 近隣の口コミは、実際に言及された建物を表示 | [探索の順序](server/apps/reviews/fallback.py)・[出典検証](server/tests/apps/reviews/test_web_reviews.py) |
| 外部APIの制約を操作設計に反映 | [キー不要のMapsリンク](web/apps/commute/links.js)・[テスト](web/tests/apps/commute/links.test.js) |
| 選んだ情報だけを共有し、期限と削除権限を設ける | [共有ストレージ](server/apps/sharing/store.py)・[出力項目の制限](web/apps/sharing/services.js) |

**技術構成：** JavaScript ES Modules、FastAPI / Pydantic、Gemini、Docling / RapidOCR、Google Maps、IndexedDB / SQLite、Docker / GitHub Actions。機能ごとに画面制御・判断ロジック・外部APIを分離し、フロントエンドはビルド不要です。

[プロダクト設計](PRODUCT.md) · [コードツアー](docs/CODE_TOUR.md) · [検証方法](docs/VALIDATION.md) · [UI設計](docs/UI_DESIGN.md)

## ローカルで動かす

Node.js 22+とPython 3を用意し、リポジトリのルートで実行します。

```bash
npm run dev:web
# http://127.0.0.1:4173/
```

記録済み候補、選択式の希望整理、Mapsリンク、HTML出力はキー不要です。実接続には[Pythonバックエンドの起動方法](docs/DEVELOPMENT.md#run-the-backend)を参照してください。APIキーはサーバー側だけで扱います。

<details>
<summary><strong>テスト・デプロイ・録画</strong></summary>

```bash
npm ci
npm run test:web
npm test                # バックエンドのテスト依存を導入した後
npm run smoke:browser   # Web/APIサーバー起動中
```

[開発ガイド](docs/DEVELOPMENT.md) · [公開デプロイ](docs/DEPLOYMENT.md) · [動画の再生成](docs/DEMO.md)

</details>

## これから充実させたい機能

- [ ] 日本の公共交通の所要時間・乗換・運賃をアプリ内で比較。
- [ ] 通勤先・余暇・日々の費用を組み合わせた候補の比較と提案。
- [ ] 口コミの対象を広げ、繰り返し見られる声を比較しやすく整理。
- [ ] 曖昧な希望や迷う条件から優先順位を見つけるAI質問の改善。
- [ ] 比較メモを共有し、別の端末でも見返しやすい体験。

[詳しいロードマップ →](ROADMAP.md)
