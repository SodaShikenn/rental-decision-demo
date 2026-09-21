from apps.listing.evidence import build_costs, build_fields, canon, contract_lines, cost_supported, is_supported
from apps.listing.mock import MOCK_MAPPING
from apps.listing.models import FIELD_KEYS, MAPPING_SCHEMA, MapperOutput
from conftest import fixture_page
from extensions.ext_ocr import OcrLine, OcrPage


def mapping(**fields):
    """MOCK_MAPPING with some fields replaced."""
    data = MOCK_MAPPING.model_dump()
    data["fields"].update(fields)
    data["warnings"] = []
    return MapperOutput.model_validate(data)


def test_every_value_in_the_fixture_mapping_is_traced_to_its_lines():
    fields, warnings = build_fields(MOCK_MAPPING, fixture_page())
    assert list(fields) == list(FIELD_KEYS)
    assert fields["propertyName"]["sourceText"] == "テストハイツ高円寺 / 203号室"
    # The union of the two cited lines (building name and room number).
    assert fields["propertyName"]["evidence"] == [0.326, 0.049, 0.1875, 0.1014]
    # 20.15 is traced through the OCR misread "20.152(6.09坪)" and agrees with the tsubo value.
    assert (fields["areaSqm"]["value"], fields["areaSqm"]["confidence"]) == (20.15, 0.94)
    assert [w["code"] for w in warnings] == ["inconsistent_values"]


def test_a_value_not_found_in_its_cited_lines_is_flagged_with_reduced_confidence():
    # The model "corrected" the OCR misread メ卜口 → メトロ; that needs a person to confirm.
    fields, warnings = build_fields(mapping(station={"value": "東京メトロ丸ノ内線「新高円寺」駅 徒歩11分", "lines": [8]}), fixture_page())
    assert fields["station"]["confidence"] == round(0.976 * 0.6, 2)
    assert any(w["fields"] == ["station"] and "一致しません" in w["message"] for w in warnings)


def test_values_without_cited_lines_or_with_unknown_ids_are_unverified():
    fields, _ = build_fields(mapping(layout={"value": "1K", "lines": [999]}), fixture_page())
    assert (fields["layout"]["confidence"], fields["layout"]["evidence"]) == (0.0, None)


def test_missing_values_stay_unknown_rather_than_low_scores():
    fields, _ = build_fields(mapping(station={"value": None, "lines": []}), fixture_page())
    assert fields["station"] == {"value": None, "confidence": None, "evidence": None, "sourceText": None}


def test_area_that_disagrees_with_the_printed_tsubo_gets_a_warning():
    _, warnings = build_fields(mapping(areaSqm={"value": 25.0, "lines": [19]}), fixture_page())
    assert any(w["code"] == "inconsistent_values" and "坪" in w["message"] for w in warnings)


def test_rent_in_man_yen_and_japanese_era_years_are_recognised():
    assert is_supported("rent", 95000, "賃料：9.5万円")
    assert is_supported("rent", 88000, "賃料：￥88,000円")
    assert not is_supported("rent", 98000, "賃料：￥88,000円")
    assert is_supported("constructionYear", 1998, "築年月：平成10年3月")
    assert is_supported("constructionYear", 2019, "竣工：令和元年")
    assert is_supported("station", "JR中央線「高円寺」駅 徒歩6分", "JR中央線「高円寺」駅徒歩6分")
    assert canon("賃　料：￥８８，０００円") == "賃料:¥88,000円"


def test_yen_amounts_match_whole_numbers_and_a_fee_can_be_included_in_the_rent():
    assert is_supported("managementFee", 5000, "賃料：125,000円/管理費：5,000円")
    assert not is_supported("managementFee", 5000, "賃料：105,000円")  # not a fee hidden inside the rent
    assert not is_supported("rent", 5000, "賃料：10.5万円")
    assert is_supported("managementFee", 0, "管理費:込")
    assert is_supported("managementFee", 0, "共益費：なし")
    assert not is_supported("managementFee", 0, "管理費：5,000円")


def test_numbers_are_sanity_checked_and_rounded():
    fields, _ = build_fields(mapping(rent={"value": -5, "lines": [9]}, areaSqm={"value": 20.1549, "lines": [19]}), fixture_page())
    assert fields["rent"]["value"] is None
    assert fields["areaSqm"]["value"] == 20.15
    # Zero rent is not a value, but a zero fee is (included in the rent).
    page = OcrPage(width=100, height=100, lines=[*fixture_page().lines, OcrLine(99, "管理費:込", 0.92, (0, 0, 50, 10))])
    fields, warnings = build_fields(mapping(rent={"value": 0, "lines": [9]}, managementFee={"value": 0, "lines": [99]}), page)
    assert fields["rent"]["value"] is None
    assert (fields["managementFee"]["value"], fields["managementFee"]["confidence"]) == (0, 0.92)
    assert not any("managementFee" in w["fields"] for w in warnings)


def test_boxes_are_clamped_to_the_page():
    page = OcrPage(width=100, height=100, lines=[OcrLine(0, "間取り:1K", 0.9, (-10, 90, 120, 130))])
    fields, _ = build_fields(mapping(layout={"value": "1K", "lines": [0]}), page)
    assert fields["layout"]["evidence"] == [0, 0.9, 1, 0.1]


def test_schema_is_flat_and_uses_nullable_type_arrays():
    text = str(MAPPING_SCHEMA)
    assert "$defs" not in text and "$ref" not in text
    assert MAPPING_SCHEMA["properties"]["fields"]["properties"]["rent"]["properties"]["value"]["type"] == ["number", "null"]
    assert MAPPING_SCHEMA["properties"]["fields"]["required"] == list(FIELD_KEYS)


def test_cost_amounts_are_traced_in_months_percent_and_yen():
    assert cost_supported("months", 1, "敷金：1ヶ月")
    assert cost_supported("months", 1, "礼金 / 1.0ヶ月")
    assert cost_supported("months", 1.5, "更新料 / 新貫料1.5ヶ月")
    assert cost_supported("months", 1, "更新：新赁料1月分更新事葬子数料")  # OCR dropped ヶ
    assert cost_supported("months", 0, "礼金：なし")
    assert cost_supported("months", 2, "フリ-レント２ヶ月分（共益費を含む）")
    assert not cost_supported("months", 2, "敷金：1ヶ月")
    assert cost_supported("percent", 50, "初回保証料総賃料の50%,年間保証料10,000円")
    assert not cost_supported("percent", 5, "初回保証料総賃料の50%")
    assert cost_supported("yen", 16500, "鍵交换費用：16，500円")
    assert not cost_supported("yen", 5000, "15,000円")


def test_costs_keep_evidence_and_flag_amounts_missing_from_their_lines():
    data = MOCK_MAPPING.model_dump()
    data["costs"] = [
        {"kind": "deposit", "label": "敷金", "amount": 1, "unit": "months", "timing": "initial", "lines": [24]},
        {"kind": "fee", "label": "鍵交換費用", "amount": 16500, "unit": "yen", "timing": "initial", "lines": [42]},
    ]
    costs, warnings = build_costs(MapperOutput.model_validate(data), fixture_page())
    assert [(cost["amount"], cost["confidence"], cost["sourceText"]) for cost in costs] == [(1, 0.99, "敷金：1ヶ月"), (16500, 0.58, "鍵交換費用：15,400円")]
    assert [warning["message"] for warning in warnings] == ["「鍵交換費用」の金額が、根拠として示された行の文字と一致しません。原本で確認してください。"]
    lines = contract_lines(fixture_page())
    assert lines[0] == {"text": "賃貸マンション", "confidence": 1.0, "box": [0.032, 0.0321, 0.199, 0.0532]}
