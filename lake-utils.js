"use strict";

const crypto = require("crypto");

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseAttributes(source) {
  const attrs = {};
  const regexp = /([:\w-]+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = regexp.exec(source || ""))) {
    attrs[match[1]] = decodeHtmlEntities(match[2]);
  }
  return attrs;
}

function decodeCardValue(value) {
  if (!value || !value.startsWith("data:")) return null;
  try {
    return JSON.parse(decodeURIComponent(value.slice(5)));
  } catch {
    return null;
  }
}

function extractCards(lakeContent) {
  const cards = [];
  const regexp = /<card\b([^>]*?)(?:\/>|>[\s\S]*?<\/card>)/gi;
  let match;
  while ((match = regexp.exec(lakeContent || ""))) {
    const attrs = parseAttributes(match[1]);
    cards.push({
      raw: match[0],
      index: match.index,
      type: attrs.type || "",
      name: attrs.name || "unknown",
      value: attrs.value || "",
      data: decodeCardValue(attrs.value),
    });
  }
  return cards;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function stableCardPayload(card) {
  if (!card.data || typeof card.data !== "object") return card.value;
  const data = { ...card.data };
  // Yuque regenerates this presentation-only id on some reads.
  delete data.id;
  return stableStringify(data);
}

function cardFingerprints(lakeContent) {
  return extractCards(lakeContent).map((card) =>
    crypto
      .createHash("sha256")
      .update(`${card.type}\0${card.name}\0${stableCardPayload(card)}`)
      .digest("hex")
  );
}

function canonicalizeLake(lakeContent) {
  return String(lakeContent || "")
    .replace(/<card\b([^>]*?)(?:\/>|>[\s\S]*?<\/card>)/gi, (raw, attrsSource) => {
      const attrs = parseAttributes(attrsSource);
      const card = {
        type: attrs.type || "",
        name: attrs.name || "unknown",
        value: attrs.value || "",
        data: decodeCardValue(attrs.value),
      };
      const stableHash = crypto
        .createHash("sha256")
        .update(stableCardPayload(card))
        .digest("hex");
      return `<card type="${card.type}" name="${card.name}" stable="${stableHash}"></card>`;
    })
    .replace(/\sdata-lake-id="[^"]*"/gi, "")
    .replace(/\sid="[^"]*"/gi, "")
    .replace(/>\s+</g, "><")
    .trim();
}

function getCardStats(lakeContent) {
  const stats = {
    total: 0,
    native_math: 0,
    legacy_latex_images: 0,
    by_name: {},
  };
  for (const card of extractCards(lakeContent)) {
    stats.total += 1;
    stats.by_name[card.name] = (stats.by_name[card.name] || 0) + 1;
    if (card.name === "math" && card.data && typeof card.data.code === "string") {
      stats.native_math += 1;
    }
    if (
      card.name === "image" &&
      card.data &&
      typeof card.data.src === "string" &&
      card.data.src.includes("/yuque/__latex/")
    ) {
      stats.legacy_latex_images += 1;
    }
  }
  return stats;
}

function cardToMarkdown(card) {
  const data = card.data || {};
  if (card.name === "math" && typeof data.code === "string") {
    return `\n\n$$\n${data.code}\n$$\n\n`;
  }
  if (card.name === "image") {
    const src = data.src || "";
    const isLegacyFormula = src.includes("/yuque/__latex/");
    const name = isLegacyFormula ? "公式（旧图片节点）" : data.name || data.alt || "图片";
    return src ? `\n![${name}](${src})\n` : "\n[语雀图片卡片]\n";
  }
  if (card.name === "localdoc") {
    const src = data.src || "";
    const name = data.name || "附件";
    return src ? `\n📎 [${name}](${src})\n` : `\n📎 ${name}\n`;
  }
  return `\n[语雀卡片：${card.name}]\n`;
}

function lakeToMarkdown(lakeContent) {
  if (!lakeContent) return "";
  let text = String(lakeContent)
    .replace(/<!doctype lake>/i, "")
    .replace(/<meta\b[^>]*\/?\s*>/gi, "")
    .replace(/<card\b([^>]*?)(?:\/>|>[\s\S]*?<\/card>)/gi, (raw, attrsSource) => {
      const attrs = parseAttributes(attrsSource);
      return cardToMarkdown({
        raw,
        type: attrs.type || "",
        name: attrs.name || "unknown",
        value: attrs.value || "",
        data: decodeCardValue(attrs.value),
      });
    });

  text = text
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, "#### $1\n\n")
    .replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, "##### $1\n\n")
    .replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, "###### $1\n\n")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<tr\b[^>]*>/gi, "\n")
    .replace(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi, "| $1 ")
    .replace(/<[^>]+>/g, "");

  return decodeHtmlEntities(text)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeHeadingText(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function listHeadings(lakeContent) {
  const headings = [];
  const regexp = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = regexp.exec(lakeContent || ""))) {
    headings.push({
      level: Number(match[1]),
      text: normalizeHeadingText(match[2]),
      index: match.index,
      end: regexp.lastIndex,
      raw: match[0],
    });
  }
  return headings;
}

function locateSection(lakeContent, headingText, headingLevel) {
  const normalized = normalizeHeadingText(headingText);
  const headings = listHeadings(lakeContent);
  const matches = headings.filter(
    (heading) =>
      heading.text === normalized &&
      (headingLevel === undefined || heading.level === Number(headingLevel))
  );
  if (matches.length === 0) {
    throw new Error(`找不到标题“${headingText}”`);
  }
  if (matches.length > 1) {
    throw new Error(`标题“${headingText}”出现 ${matches.length} 次，请同时指定 heading_level`);
  }
  const heading = matches[0];
  const next = headings.find(
    (candidate) => candidate.index >= heading.end && candidate.level <= heading.level
  );
  return {
    heading,
    contentStart: heading.end,
    contentEnd: next ? next.index : String(lakeContent).length,
    nextHeading: next || null,
  };
}

function stripLakeEnvelope(lakeContent) {
  let fragment = String(lakeContent || "").trim();
  fragment = fragment.replace(/^<!doctype lake>/i, "");
  fragment = fragment.replace(/^(?:\s*<meta\b[^>]*\/?\s*>)+/i, "");
  return fragment.trim();
}

function patchLakeSection(lakeContent, headingText, replacementLake, headingLevel) {
  const location = locateSection(lakeContent, headingText, headingLevel);
  const fragment = stripLakeEnvelope(replacementLake);
  for (const heading of listHeadings(fragment)) {
    if (heading.level <= location.heading.level) {
      throw new Error(
        `章节正文中包含 ${heading.level} 级标题“${heading.text}”，不得高于或等于目标标题层级 ${location.heading.level}`
      );
    }
  }
  const prefix = String(lakeContent).slice(0, location.contentStart);
  const suffix = String(lakeContent).slice(location.contentEnd);
  const updated = prefix + fragment + suffix;
  if (!updated.startsWith(prefix) || !updated.endsWith(suffix)) {
    throw new Error("局部更新保护校验失败");
  }
  return {
    updated,
    fragment,
    location,
    protectedCardFingerprints: cardFingerprints(prefix + suffix),
  };
}

function countMarkdownFormulaBlocks(markdown) {
  return (String(markdown || "").match(/(^|\n)\s*\$\$[\s\S]*?\$\$\s*(?=\n|$)/g) || []).length;
}

module.exports = {
  canonicalizeLake,
  cardFingerprints,
  countMarkdownFormulaBlocks,
  decodeCardValue,
  extractCards,
  getCardStats,
  lakeToMarkdown,
  listHeadings,
  locateSection,
  normalizeHeadingText,
  patchLakeSection,
  stripLakeEnvelope,
};
