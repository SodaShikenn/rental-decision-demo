// Deterministic reading for EXTRACTION_MODE=mock: lets the front end and tests run without
// calling Claude or spending credits. Values match the fictional tests/fixtures/listing-sheet.png;
// boxes are in that 2000x1184 pixel space and are scaled to whatever image was uploaded.
// Responses are labelled meta.mode = "mock" so they are never presented as a real reading.

export const MOCK_MODEL = "mock-fixture";
const FIXTURE = { width: 2000, height: 1184 };

const FIELDS = {
  propertyName: { value: "テストハイツ高円寺 203号室", confidence: 0.96, sourceText: "テストハイツ高円寺 / 203号室", box: [654, 61, 1028, 176] },
  rent: { value: 88000, confidence: 0.98, sourceText: "賃　料：￥88,000円", box: [65, 272, 510, 316] },
  address: { value: "東京都杉並区高円寺南9-99-99", confidence: 0.93, sourceText: "所在地：東京都杉並区高円寺南9-99-99", box: [65, 429, 407, 448] },
  station: { value: "JR中央線「高円寺」駅 徒歩6分", confidence: 0.9, sourceText: "JR中央線「高円寺」駅 徒歩6分", box: [91, 170, 361, 189] },
  layout: { value: "1K", confidence: 0.97, sourceText: "間取り：1K", box: [65, 537, 167, 556] },
  areaSqm: { value: 20.15, confidence: 0.72, sourceText: "専有面積：20.15㎡（6.09坪）", box: [65, 510, 333, 529] },
  constructionYear: { value: 1998, confidence: 0.95, sourceText: "竣　工：1998年3月", box: [65, 483, 241, 502] },
};

/** Mock reading in the same shape Claude returns, scaled to the uploaded image. */
export function mockReading(image) {
  const sx = image.width / FIXTURE.width;
  const sy = image.height / FIXTURE.height;
  const fields = Object.fromEntries(
    Object.entries(FIELDS).map(([key, { box: [x1, y1, x2, y2], ...rest }]) => [
      key,
      { ...rest, box: { x1: x1 * sx, y1: y1 * sy, x2: x2 * sx, y2: y2 * sy } },
    ]),
  );
  return {
    fields,
    warnings: [
      {
        code: "inconsistent_values",
        message: "専有面積が物件概要（20.15㎡）と間取り図（21.15㎡）で異なります。",
        fields: ["areaSqm"],
      },
    ],
  };
}
