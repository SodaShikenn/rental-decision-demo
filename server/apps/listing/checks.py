"""Pre-contract checks: clauses renters tend to overlook, found in the OCR text by fixed rules.

The list was drawn from asking a general-purpose LLM what renters miss on real listing sheets, then
kept to what can be recognized from the printed words. Each check cites the lines it matched, so the
page can show them next to the original. Rules are deterministic and cheap, but not exhaustive: a
clause printed in unusual words is missed, and the page says so.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from extensions.ext_ocr import OcrLine, OcrPage

from .evidence import union_box, canon

MAX_LINES_PER_CHECK = 3

# Look-alike glyphs Japanese OCR produces on these sheets (simplified Chinese forms, kanji for katakana).
LOOKALIKES = str.maketrans({"键": "鍵", "换": "換", "约": "約", "须": "須", "证": "証", "违": "違", "费": "費", "险": "険", "现": "現", "况": "況", "务": "務", "项": "項", "卜": "ト", "赁": "賃"})


def fold(text: str) -> str:
    return canon(text).translate(LOOKALIKES).replace("保征", "保証")


@dataclass(frozen=True)
class Rule:
    code: str
    category: str  # cost, exit, viewing, eligibility, building
    title: str
    detail: str
    pattern: re.Pattern[str]


RULES = [
    Rule("short_term_penalty", "exit", "短期解約違約金",
         "早く退去すると、家賃1〜2ヶ月分ほどの違約金がかかります。転勤や転職の可能性があるなら、期間と金額を確認してください。",
         re.compile(r"違約金|短期解約|短期違約")),
    Rule("notice_period", "exit", "解約予告の期間",
         "退去の何ヶ月前までに申し出るかの取り決めです。2ヶ月前だと、急な引っ越しで二重家賃が増えます。",
         re.compile(r"(解約|解除)(予告|子告)")),
    Rule("renewal_fee", "exit", "更新料",
         "多くは2年ごとに支払います。「新賃料の」とあれば、家賃が改定されると更新料も変わります。更新事務手数料が別にかかることもあります。",
         re.compile(r"更新料|更新[:：]")),
    Rule("fixed_term", "exit", "定期借家",
         "期間が満了すると契約が終わり、更新されません。住み続けるには貸主との再契約が必要です。",
         re.compile(r"定期借家|定期建物")),
    Rule("free_rent", "exit", "フリーレント",
         "一定期間の家賃が無料になる条件です。短期解約違約金と組み合わされていることが多く、早く退去すると無料分を相殺されます。",
         re.compile(r"フリ.?レント")),
    Rule("deposit_amortized", "cost", "敷金・保証金の償却",
         "「償却」「敷引き」の分は、退去時に戻ってきません。敷金が全額償却なら、実質的には礼金と同じです。",
         re.compile(r"償却|敷引")),
    Rule("guarantor_fees", "cost", "保証会社の保証料",
         "初回の保証料に加えて、毎月や毎年の保証料がかかることがあります。家賃と管理費だけで比べると、実際の負担を見誤ります。",
         re.compile(r"保証会社|保証料|保証委託")),
    Rule("required_services", "cost", "必須の付帯サービス",
         "24時間サポート・駆け付け・抗菌・消毒などの費用です。必須か任意か、外せるかを確認してください。",
         re.compile(r"サポ|サ.一ト|駆付|駆け付|抗菌|消毒|Plus24|クラブ")),
    Rule("insurance", "cost", "火災保険",
         "加入が必須です。指定の保険か、自分で選んだ保険に替えられるかで費用が変わります。",
         re.compile(r"火災保険|総合保険")),
    Rule("key_exchange", "cost", "鍵交換費用",
         "入居時に払う一時金です。図面の小さな欄に書かれていることが多く、見積書で見落としやすい費用です。",
         re.compile(r"鍵交換")),
    Rule("cleaning", "cost", "クリーニング費用",
         "入居時の前払いか、退去時の精算かを確認してください。敷金がない物件では、退去時に別途請求されます。",
         re.compile(r"クリ.?ニング")),
    Rule("admin_fee", "cost", "手数料",
         "契約事務手数料や引落手数料など、仲介手数料とは別にかかる手数料です。",
         re.compile(r"手数料|手数科")),
    Rule("before_viewing", "viewing", "内見の時期・先行契約",
         "居住中の部屋は、内見の前に申し込みや契約を求められることがあります。内見後に断れるか、家賃がいつから発生するかを確認してください。",
         re.compile(r"先行契約|居住中|内見前|案内可能日")),
    Rule("photos_differ", "viewing", "写真は別の部屋",
         "掲載写真がこの部屋ではありません。日当たり・設備・傷み具合は、実物で確認してください。",
         re.compile(r"別部屋|別間取")),
    Rule("as_is", "viewing", "現況優先",
         "図面や写真と実物が違う場合は、実物（現況）が優先されます。設備や広さは内見と重要事項説明で確認してください。",
         re.compile(r"現況")),
    Rule("extra_terms", "viewing", "図面にない補足事項",
         "図面に載っていない条件があるという表記です。入居条件・特約・追加費用を、仲介会社に全文で見せてもらってください。",
         re.compile(r"補足事項|詳細備考")),
    Rule("foreign_terms", "eligibility", "外国籍の方の条件",
         "国籍によって、保証料・預け金・緊急連絡先などの条件が変わることがあります。自分に当てはまる条件で費用を計算してください。",
         re.compile(r"外国籍")),
    Rule("restrictions", "eligibility", "使用の制限",
         "ペット・楽器・事務所利用（SOHO）などの制限です。在宅での仕事や将来の予定と合うか確認してください。",
         re.compile(r"ペット|楽器|SOHO|事務所|二人入居|ルームシェア")),
    Rule("no_elevator", "building", "エレベーターなし",
         "上の階だと、毎日の上り下りに加えて、引っ越しで大型家具や家電を階段で運ぶ必要があります。",
         re.compile(r"エレベ.?タ.?[/:]?(無|なし)|EV[/:]?(無|なし)")),
]
CATEGORY_ORDER = ["cost", "exit", "viewing", "eligibility", "building"]
GROUND_FLOOR = Rule("ground_floor", "building", "1階の部屋",
                    "防犯、外からの視線、湿気や結露、日当たりを内見で確認してください。",
                    re.compile(r"(?<!\d)1\d{2}号室"))


def _check(rule: Rule, lines: list[OcrLine], page: OcrPage) -> dict[str, Any]:
    cited = lines[:MAX_LINES_PER_CHECK]
    return {
        "code": rule.code,
        "category": rule.category,
        "title": rule.title,
        "detail": rule.detail,
        "evidence": union_box(cited, page.width, page.height),
        "sourceText": " / ".join(line.text for line in cited),
    }


def detect_checks(page: OcrPage, fields: dict[str, dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Every rule that matches the page, grouped by category (cost, exit, viewing, eligibility, building)."""
    folded = [(line, fold(line.text)) for line in page.lines]
    checks = []
    for rule in RULES:
        matched = [line for line, text in folded if rule.pattern.search(text)]
        if matched:
            checks.append(_check(rule, matched, page))
    # A room number in the 100s means the ground floor. Read it from the confirmed name, not the whole
    # sheet, so a phone number or an address cannot trigger it.
    name = (fields or {}).get("propertyName", {}).get("value")
    if name and GROUND_FLOOR.pattern.search(fold(str(name))):
        named = [line for line, text in folded if GROUND_FLOOR.pattern.search(text)]
        if named:
            checks.append(_check(GROUND_FLOOR, named, page))
    return sorted(checks, key=lambda check: CATEGORY_ORDER.index(check["category"]))
