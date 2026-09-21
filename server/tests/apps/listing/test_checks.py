from apps.listing.checks import detect_checks, fold
from extensions.ext_ocr import OcrLine, OcrPage


def page_of(*texts: str) -> OcrPage:
    return OcrPage(width=1000, height=1000, lines=[OcrLine(i, text, 0.95, (10, i * 20, 400, i * 20 + 15)) for i, text in enumerate(texts)])


def codes(page: OcrPage, name: str | None = None) -> list[str]:
    fields = {"propertyName": {"value": name}} if name else None
    return [check["code"] for check in detect_checks(page, fields)]


def test_clauses_are_found_through_the_ocr_misreads_on_real_sheets():
    # Lines as Docling read them on the real sheets, look-alike glyphs included.
    page = page_of(
        "敷金償却：1ヶ月",
        "鍵交换費用：16，500円",
        "1年未満で解約の場合違約金1ヶ月かかります。",
        "解约予告",
        "保征会社 個人(日本国籍)初回：黄科等の50%-月次1%",
        "24時間サボ一ト代(2年)",
        "命補足事项あり(詳細はITANDI詳轴備考をご確認ください)",
        "宗揭載写真は別部屋・別間取りのものです。参考程度にご覧ください。",
        "【物件概要】所在地/東京都世田谷区羽根木2-28-19構造/壁式鉄筋コクリ-卜造地上4階建総戸数/20戸築年月/2026年6月入居時期/即日エレベ-タ-/無",
        "その他条件ペッ卜飼育不可、SOHO利用不可",
    )
    assert codes(page) == [
        "deposit_amortized", "guarantor_fees", "required_services", "key_exchange",
        "short_term_penalty", "notice_period",
        "photos_differ", "extra_terms",
        "restrictions",
        "no_elevator",
    ]


def test_each_check_cites_its_lines_and_explains_why():
    [check] = detect_checks(page_of("賃料：125,000円", "短期解約違約金の設定あり", "(1年以内2ヶ月/2年以内1ヶ月)"))
    assert check["code"] == "short_term_penalty" and check["category"] == "exit"
    assert check["sourceText"] == "短期解約違約金の設定あり"
    assert check["evidence"] == [0.01, 0.02, 0.39, 0.015]
    assert "違約金" in check["detail"]


def test_ground_floor_comes_from_the_room_number_only():
    page = page_of("モノハウス", "104号室", "TEL:03-3582-2652")
    assert codes(page, "モノハウス 104号室") == ["ground_floor"]
    assert codes(page_of("ルーブル渋谷松濤", "408号室"), "ルーブル渋谷松濤 408号室") == []
    assert codes(page_of("1104号室"), "タワー 1104号室") == []


def test_a_plain_sheet_raises_no_checks():
    assert codes(page_of("賃料：88,000円", "間取り:1K", "所在地：東京都杉並区高円寺南9-99-99")) == []
    assert fold("キーの交换") == "キーの交換"
