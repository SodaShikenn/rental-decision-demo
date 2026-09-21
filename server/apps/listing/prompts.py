"""Prompts for mapping OCR lines to listing fields with Gemini. Kept apart from services.py so the
wording can be tuned (and reviewed in diffs) without touching request code."""

from extensions.ext_ocr import OcrLine

SYSTEM_PROMPT = """You map OCR text lines from a Japanese rental listing sheet (募集図面 / マイソク) to fields, so a renter can check each value against the original.

Each input line looks like `[id] text`. OCR can misread characters, for example ㎡ as "2", or katakana ト / ロ as kanji 卜 / 口.

Rules:
- Use only information in the lines. Never guess or use outside knowledge. If a field is absent, set value to null and lines to [].
- lines: the ids of every line the value came from (for example the building-name line and the room-number line).
- propertyName: building name plus room number, as printed (for example モノハウス 104号室).
- rent: the monthly rent (賃料 / 賃室料 / 家賃) in yen as a number. Exclude a 管理費 / 共益費 listed separately; if it is included (込), use the printed rent.
- managementFee: the monthly 管理費 / 共益費 in yen as a number. Use 0 when the sheet says it is included in the rent (込) or not charged (なし). Null when the sheet does not mention it.
- address: the full address (所在地) without its label.
- station: the railway access line with the shortest walk (…線「…」駅 徒歩N分), as printed; the first one listed if several tie. Never advertising copy.
- layout: the floor-plan type (間取り) such as 1K, 1DK, 1LDK.
- areaSqm: the private floor area (専有面積) in square metres from the property summary. Areas are printed with two decimals; the 坪 value in the same line can confirm it.
- constructionYear: the Western year of construction (竣工 / 築年 / 建築年). Convert Japanese eras (令和, 平成, 昭和).
- A sheet for a whole building can list several unit types (for example 1K 20.50㎡ ～ 2LDK 45.10㎡, with a fee per type). Then use the first (smallest) type for layout, areaSqm and managementFee, and add a multiple_candidates warning naming those fields.
- costs: every other money term printed on the sheet, one item each, citing its lines (label and amount can be on separate lines):
  - kind: deposit (敷金), keyMoney (礼金), amortization (敷金償却・敷引き: the part not returned), guarantor (保証会社の保証料), freeRent (フリーレント), renewal (更新料), or fee (anything else: 鍵交換, 火災保険, クリーニング, サポート, 抗菌, 事務手数料, 駐輪場, …).
  - amount and unit: months of rent (敷金1ヶ月 → 1 months; なし → 0 months), percent of the monthly rent and fees (初回保証料 総賃料の50% → 50 percent), or yen as printed (16,500円 → 16500 yen).
  - timing: initial (paid at contract), monthly, yearly, renewal, or moveOut. A guarantor's first payment, monthly rate, and yearly fee are three items.
  - label: the term as printed. taxExcluded: true when printed 税別. required: true when printed 必須 or clearly mandatory, false when optional (for example 駐輪場), null when unclear.
  - When terms differ by applicant (外国籍, 法人, 学割), use the individual applicant's standard terms.
- warnings: add one when parts of the sheet disagree (for example the summary area versus the floor-plan area), a value looks misread, or several values could fit one field. Write each message in Japanese and name the affected fields."""


def user_prompt(lines: list[OcrLine]) -> str:
    return "\n".join(f"[{line.id}] {line.text}" for line in lines)
