"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  cardFingerprints,
  canonicalizeLake,
  getCardStats,
  lakeToMarkdown,
  locateSection,
  patchLakeSection,
} = require("../lake-utils.js");

function card(name, data) {
  return `<card type="inline" name="${name}" value="data:${encodeURIComponent(
    JSON.stringify(data)
  )}"></card>`;
}

test("native math cards round-trip to Yuque-compatible block LaTeX", () => {
  const lake = `<!doctype lake><h2>盐水类</h2><p>${card("math", {
    code: "R=\\frac{a}{b}",
    id: "m1",
  })}</p>`;
  const markdown = lakeToMarkdown(lake);
  assert.match(markdown, /\$\$\nR=\\frac\{a\}\{b\}\n\$\$/);
  assert.deepEqual(getCardStats(lake), {
    total: 1,
    native_math: 1,
    legacy_latex_images: 0,
    by_name: { math: 1 },
  });
});

test("legacy LaTeX image cards remain visible instead of being dropped", () => {
  const src = "https://cdn.nlark.com/yuque/__latex/deadbeef.svg";
  const lake = `<!doctype lake><p>${card("image", { src })}</p>`;
  assert.match(lakeToMarkdown(lake), /!\[公式（旧图片节点）\]\(https:\/\/cdn\.nlark\.com/);
  assert.equal(getCardStats(lake).legacy_latex_images, 1);
});

test("section patch preserves every card outside the selected heading", () => {
  const oldFormula = card("image", {
    src: "https://cdn.nlark.com/yuque/__latex/old.svg",
  });
  const unrelated = card("image", { src: "https://example.com/chart.png" });
  const newFormula = card("math", { code: "R=1", id: "new" });
  const original = `<!doctype lake><meta name="doc-version" content="1" /><h1>资料分析</h1><h2>比重类</h2><p>${oldFormula}</p><h2>盐水类</h2><p>旧内容</p><h2>其他</h2><p>${unrelated}</p>`;
  const before = locateSection(original, "盐水类");
  const protectedBefore = cardFingerprints(
    original.slice(0, before.contentStart) + original.slice(before.contentEnd)
  );
  const result = patchLakeSection(
    original,
    "盐水类",
    `<!doctype lake><meta name="doc-version" content="1" /><h3>公式</h3><p>${newFormula}</p>`
  );
  const after = locateSection(result.updated, "盐水类");
  const protectedAfter = cardFingerprints(
    result.updated.slice(0, after.contentStart) + result.updated.slice(after.contentEnd)
  );
  assert.deepEqual(protectedAfter, protectedBefore);
  assert.equal(getCardStats(result.updated).native_math, 1);
  assert.equal(getCardStats(result.updated).legacy_latex_images, 1);
});

test("section patch rejects headings that escape the selected hierarchy", () => {
  const original = "<!doctype lake><h2>盐水类</h2><p>旧内容</p><h2>其他</h2>";
  assert.throws(
    () => patchLakeSection(original, "盐水类", "<!doctype lake><h2>越界</h2>"),
    /不得高于或等于目标标题层级/
  );
});

test("duplicate headings fail closed unless a unique level is supplied", () => {
  const original = "<!doctype lake><h2>总结</h2><p>A</p><h3>总结</h3><p>B</p>";
  assert.throws(() => locateSection(original, "总结"), /出现 2 次/);
  assert.equal(locateSection(original, "总结", 3).heading.level, 3);
});

test("canonical Lake ignores volatile element ids returned by Yuque", () => {
  const a = '<!doctype lake><h2 data-lake-id="abc" id="abc"><span id="x">盐水类</span></h2>';
  const b = '<!doctype lake><h2 data-lake-id="def" id="def"><span id="y">盐水类</span></h2>';
  assert.equal(canonicalizeLake(a), canonicalizeLake(b));
});

test("card fingerprints ignore Yuque's volatile math card id", () => {
  const a = `<!doctype lake><p>${card("math", { code: "a=b", id: "first" })}</p>`;
  const b = `<!doctype lake><p>${card("math", { code: "a=b", id: "second" })}</p>`;
  assert.deepEqual(cardFingerprints(a), cardFingerprints(b));
  assert.equal(canonicalizeLake(a), canonicalizeLake(b));
});
