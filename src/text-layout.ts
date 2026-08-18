export type SvgTextAlignment = "center" | "left" | "right";

export interface SvgTextStyleDefinition {
  alignment: SvgTextAlignment;
  backgroundColor: string;
  font: string;
  fontPercent: number;
  textColor: string;
}

export interface SvgTextRichStyleDefinition extends SvgTextStyleDefinition {
  rubyFontPercent: number;
  rubyGap: number;
}

export type SvgTextNativeSize = readonly [width: number, height: number];

export interface SvgTextLayoutStyle {
  readonly alignment: SvgTextAlignment;
  readonly backgroundColor: string;
  readonly cornerRadius: number;
  readonly font: string;
  readonly fontPercent: number;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly padding: number;
  readonly textColor: string;
}

export interface SvgTextLayoutLine {
  readonly baseline: number;
  readonly text: string;
  readonly width: number;
  readonly x: number;
}

export interface SvgTextLayout {
  readonly height: number;
  readonly lines: readonly SvgTextLayoutLine[];
  readonly preserveWhitespace: true;
  readonly style: SvgTextLayoutStyle;
  readonly width: number;
}

export interface SvgTextContentTextRun {
  readonly text: string;
  readonly type: "text";
}

export interface SvgTextContentRubyRun {
  readonly base: string;
  readonly reading: string;
  readonly type: "ruby";
}

export type SvgTextContentRun = SvgTextContentRubyRun | SvgTextContentTextRun;

export interface SvgTextRichLayoutStyle extends SvgTextLayoutStyle {
  readonly rubyFontPercent: number;
  readonly rubyFontSize: number;
  readonly rubyGap: number;
}

export interface SvgTextRevealUnit {
  readonly end: number;
  readonly index: number;
  readonly runIndex: number;
  readonly start: number;
  readonly type: "ruby" | "text";
}

export interface SvgTextRichLayoutGlyph {
  readonly baseline: number;
  readonly fontSize: number;
  readonly text: string;
  readonly width: number;
  readonly x: number;
}

export interface SvgTextRichLayoutTextFragment {
  readonly baseline: number;
  readonly revealIndex: number;
  readonly text: string;
  readonly type: "text";
  readonly width: number;
  readonly x: number;
}

export interface SvgTextRichLayoutRubyFragment {
  readonly base: SvgTextRichLayoutGlyph;
  readonly reading: SvgTextRichLayoutGlyph;
  readonly revealIndex: number;
  readonly type: "ruby";
  readonly width: number;
  readonly x: number;
}

export type SvgTextRichLayoutFragment =
  SvgTextRichLayoutRubyFragment | SvgTextRichLayoutTextFragment;

export interface SvgTextRichLayoutLine {
  readonly ascent: number;
  readonly baseline: number;
  readonly descent: number;
  readonly fragments: readonly SvgTextRichLayoutFragment[];
  readonly height: number;
  readonly overflow: boolean;
  readonly width: number;
  readonly x: number;
}

export interface SvgTextRichLayout {
  readonly height: number;
  readonly lines: readonly SvgTextRichLayoutLine[];
  readonly overflow: boolean;
  readonly plainText: string;
  readonly preserveWhitespace: true;
  readonly readingText: string;
  readonly revealUnits: readonly SvgTextRevealUnit[];
  readonly style: SvgTextRichLayoutStyle;
  readonly width: number;
}

interface TextMetrics {
  cornerRadius: number;
  fontScale: number;
  fontSize: number;
  lineHeight: number;
  padding: number;
}

interface GraphemeSegment {
  end: number;
  segment: string;
  start: number;
}

interface RichTextUnit {
  reveal: SvgTextRevealUnit;
  text: string;
  type: "text";
  width: number;
}

interface RichRubyUnit {
  base: string;
  baseWidth: number;
  reading: string;
  readingWidth: number;
  reveal: SvgTextRevealUnit;
  type: "ruby";
  width: number;
}

type RichLayoutUnit = RichRubyUnit | RichTextUnit;

interface PendingRichLine {
  units: RichLayoutUnit[];
  width: number;
}

const baseStageWidth = 480;
const baseStageHeight = 360;
const defaultFontPercent = 100;
const defaultRubyFontPercent = 50;
const defaultRubyGap = 1;
const maximumFontNameLength = 128;
const textStyle = {
  fontSize: 14,
  lineHeight: 16,
  padding: 12,
  cornerRadius: 8,
} as const;

export const DEFAULT_SVG_TEXT_STYLE: Readonly<SvgTextStyleDefinition> =
  Object.freeze({
    alignment: "left",
    backgroundColor: "#ffffff",
    font: "Helvetica",
    fontPercent: defaultFontPercent,
    textColor: "#575e75",
  });

export const DEFAULT_SVG_TEXT_RICH_STYLE: Readonly<SvgTextRichStyleDefinition> =
  Object.freeze({
    ...DEFAULT_SVG_TEXT_STYLE,
    rubyFontPercent: defaultRubyFontPercent,
    rubyGap: defaultRubyGap,
  });

export function createSvgTextLayout(
  text: string,
  definition: Readonly<SvgTextStyleDefinition>,
  nativeSize: SvgTextNativeSize,
): SvgTextLayout {
  const metrics = createTextMetrics(definition, nativeSize);
  const lineMeasurements = text.split("\n").map((line) => ({
    text: line,
    width: measureTextWidth(line, metrics.fontSize),
  }));
  const contentWidth = Math.max(
    1,
    ...lineMeasurements.map((line) => line.width),
  );
  const width = Math.max(1, Math.ceil(contentWidth + metrics.padding * 2));
  const height = Math.max(
    1,
    Math.ceil(
      metrics.lineHeight * lineMeasurements.length + metrics.padding * 2,
    ),
  );
  const x =
    definition.alignment === "center"
      ? width / 2
      : definition.alignment === "right"
        ? width - metrics.padding
        : metrics.padding;
  const lines = Object.freeze(
    lineMeasurements.map((line, index) =>
      Object.freeze({
        baseline:
          metrics.padding + metrics.fontSize + metrics.lineHeight * index,
        text: line.text,
        width: line.width,
        x,
      }),
    ),
  );
  const style = createLayoutStyle(definition, metrics);

  return Object.freeze({
    height,
    lines,
    preserveWhitespace: true,
    style,
    width,
  });
}

export function createSvgTextRichLayout(
  runs: readonly SvgTextContentRun[],
  definition: Readonly<SvgTextRichStyleDefinition>,
  nativeSize: SvgTextNativeSize,
  maxWidth?: number,
): SvgTextRichLayout {
  const metrics = createTextMetrics(definition, nativeSize);
  const rubyFontSize =
    metrics.fontSize * (definition.rubyFontPercent / defaultFontPercent);
  const rubyGap = definition.rubyGap * metrics.fontScale;
  const style = Object.freeze({
    ...createLayoutStyle(definition, metrics),
    rubyFontPercent: definition.rubyFontPercent,
    rubyFontSize,
    rubyGap,
  });
  const plainText = runs
    .map((run) => (run.type === "ruby" ? run.base : run.text))
    .join("");
  const readingText = runs
    .map((run) => (run.type === "ruby" ? run.reading : run.text))
    .join("");
  const revealUnits: SvgTextRevealUnit[] = [];
  const items: Array<RichLayoutUnit | "break"> = [];

  for (const [runIndex, run] of runs.entries()) {
    if (run.type === "ruby") {
      const reveal = Object.freeze({
        end: run.base.length,
        index: revealUnits.length,
        runIndex,
        start: 0,
        type: "ruby" as const,
      });
      revealUnits.push(reveal);
      const baseWidth = measureTextWidth(run.base, metrics.fontSize);
      const readingWidth = measureTextWidth(run.reading, rubyFontSize);
      items.push({
        base: run.base,
        baseWidth,
        reading: run.reading,
        readingWidth,
        reveal,
        type: "ruby",
        width: Math.max(baseWidth, readingWidth),
      });
      continue;
    }

    for (const grapheme of segmentGraphemes(run.text)) {
      if (grapheme.segment === "\n") {
        items.push("break");
        continue;
      }
      const reveal = Object.freeze({
        end: grapheme.end,
        index: revealUnits.length,
        runIndex,
        start: grapheme.start,
        type: "text" as const,
      });
      revealUnits.push(reveal);
      items.push({
        reveal,
        text: grapheme.segment,
        type: "text",
        width: measureTextWidth(grapheme.segment, metrics.fontSize),
      });
    }
  }

  const contentLimit =
    maxWidth === undefined
      ? undefined
      : Math.max(1, maxWidth - metrics.padding * 2);
  const pendingLines: PendingRichLine[] = [];
  let pendingLine: PendingRichLine = { units: [], width: 0 };
  const finishLine = (): void => {
    pendingLines.push(pendingLine);
    pendingLine = { units: [], width: 0 };
  };

  for (const item of items) {
    if (item === "break") {
      finishLine();
      continue;
    }
    if (
      contentLimit !== undefined &&
      pendingLine.units.length > 0 &&
      pendingLine.width + item.width > contentLimit
    ) {
      finishLine();
    }
    pendingLine.units.push(item);
    pendingLine.width += item.width;
  }
  finishLine();

  const maximumLineWidth = Math.max(
    1,
    ...pendingLines.map((line) => line.width),
  );
  const naturalWidth = maximumLineWidth + metrics.padding * 2;
  const width = Math.max(
    1,
    Math.ceil(
      maxWidth === undefined ? naturalWidth : Math.max(maxWidth, naturalWidth),
    ),
  );
  const baseDescent = Math.max(0, metrics.lineHeight - metrics.fontSize);
  let lineTop = metrics.padding;
  const lines = Object.freeze(
    pendingLines.map((pending) => {
      const hasRuby = pending.units.some((unit) => unit.type === "ruby");
      const ascent = metrics.fontSize + (hasRuby ? rubyFontSize + rubyGap : 0);
      const descent = baseDescent;
      const height = ascent + descent;
      const baseline = lineTop + ascent;
      const x =
        definition.alignment === "center"
          ? (width - pending.width) / 2
          : definition.alignment === "right"
            ? width - metrics.padding - pending.width
            : metrics.padding;
      let fragmentX = x;
      const fragments = Object.freeze(
        pending.units.map((unit): SvgTextRichLayoutFragment => {
          if (unit.type === "text") {
            const fragment = Object.freeze({
              baseline,
              revealIndex: unit.reveal.index,
              text: unit.text,
              type: "text" as const,
              width: unit.width,
              x: fragmentX,
            });
            fragmentX += unit.width;
            return fragment;
          }

          const groupX = fragmentX;
          const base = Object.freeze({
            baseline,
            fontSize: metrics.fontSize,
            text: unit.base,
            width: unit.baseWidth,
            x: groupX + (unit.width - unit.baseWidth) / 2,
          });
          const reading = Object.freeze({
            baseline: baseline - metrics.fontSize - rubyGap,
            fontSize: rubyFontSize,
            text: unit.reading,
            width: unit.readingWidth,
            x: groupX + (unit.width - unit.readingWidth) / 2,
          });
          const fragment = Object.freeze({
            base,
            reading,
            revealIndex: unit.reveal.index,
            type: "ruby" as const,
            width: unit.width,
            x: groupX,
          });
          fragmentX += unit.width;
          return fragment;
        }),
      );
      const line = Object.freeze({
        ascent,
        baseline,
        descent,
        fragments,
        height,
        overflow: contentLimit !== undefined && pending.width > contentLimit,
        width: pending.width,
        x,
      });
      lineTop += height;
      return line;
    }),
  );
  const height = Math.max(1, Math.ceil(lineTop + metrics.padding));
  const overflow = lines.some((line) => line.overflow);

  return Object.freeze({
    height,
    lines,
    overflow,
    plainText,
    preserveWhitespace: true,
    readingText,
    revealUnits: Object.freeze(revealUnits),
    style,
    width,
  });
}

export function renderSvgTextLayout(layout: SvgTextLayout): string {
  const textAnchor =
    layout.style.alignment === "center"
      ? "middle"
      : layout.style.alignment === "right"
        ? "end"
        : "start";
  const text = layout.lines.map((line) => line.text).join("\n");
  const tspans = layout.lines
    .map(
      (line) =>
        `<tspan x="${formatSvgNumber(line.x)}" y="${formatSvgNumber(line.baseline)}">${escapeXml(line.text)}</tspan>`,
    )
    .join("");

  const whitespaceAttribute = layout.preserveWhitespace
    ? ' xml:space="preserve"'
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img"><title>${escapeXml(text)}</title><rect width="${layout.width}" height="${layout.height}" rx="${formatSvgNumber(layout.style.cornerRadius)}" fill="${escapeXml(layout.style.backgroundColor)}"/><text${whitespaceAttribute} fill="${escapeXml(layout.style.textColor)}" font-family="${escapeXml(layout.style.font)}" font-size="${formatSvgNumber(layout.style.fontSize)}" text-anchor="${textAnchor}">${tspans}</text></svg>`;
}

export function renderSvgTextRichLayout(layout: SvgTextRichLayout): string {
  const tspans = layout.lines
    .flatMap((line) =>
      line.fragments.flatMap((fragment) => {
        if (fragment.type === "text") {
          return [
            `<tspan x="${formatSvgNumber(fragment.x)}" y="${formatSvgNumber(fragment.baseline)}" font-size="${formatSvgNumber(layout.style.fontSize)}">${escapeXml(fragment.text)}</tspan>`,
          ];
        }
        return [
          `<tspan x="${formatSvgNumber(fragment.reading.x)}" y="${formatSvgNumber(fragment.reading.baseline)}" font-size="${formatSvgNumber(fragment.reading.fontSize)}">${escapeXml(fragment.reading.text)}</tspan>`,
          `<tspan x="${formatSvgNumber(fragment.base.x)}" y="${formatSvgNumber(fragment.base.baseline)}" font-size="${formatSvgNumber(fragment.base.fontSize)}">${escapeXml(fragment.base.text)}</tspan>`,
        ];
      }),
    )
    .join("");
  const whitespaceAttribute = layout.preserveWhitespace
    ? ' xml:space="preserve"'
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img"><title>${escapeXml(layout.plainText)}</title><rect width="${layout.width}" height="${layout.height}" rx="${formatSvgNumber(layout.style.cornerRadius)}" fill="${escapeXml(layout.style.backgroundColor)}"/><text${whitespaceAttribute} fill="${escapeXml(layout.style.textColor)}" font-family="${escapeXml(layout.style.font)}" text-anchor="start">${tspans}</text></svg>`;
}

export function normalizeSvgTextColor(value: string, fallback: string): string {
  const color = value.trim();
  if (color === "") return fallback;
  if (color.toLowerCase() === "transparent") return color;
  if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/iu.test(color)) {
    return color;
  }
  if (globalThis.CSS?.supports?.("color", color)) return color;
  return fallback;
}

export function normalizeSvgTextFont(value: string): string {
  const font = value.trim();
  const hasUnsafeCharacter = [...font].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127 || ",;{}".includes(character);
  });
  if (
    font === "" ||
    font.length > maximumFontNameLength ||
    hasUnsafeCharacter
  ) {
    return DEFAULT_SVG_TEXT_STYLE.font;
  }
  return font;
}

function createTextMetrics(
  definition: Readonly<SvgTextStyleDefinition>,
  nativeSize: SvgTextNativeSize,
): TextMetrics {
  const stageScale = Math.min(
    nativeSize[0] / baseStageWidth,
    nativeSize[1] / baseStageHeight,
  );
  const fontScale = stageScale * (definition.fontPercent / defaultFontPercent);
  return {
    cornerRadius: textStyle.cornerRadius * stageScale,
    fontScale,
    fontSize: textStyle.fontSize * fontScale,
    lineHeight: textStyle.lineHeight * fontScale,
    padding: textStyle.padding * stageScale,
  };
}

function createLayoutStyle(
  definition: Readonly<SvgTextStyleDefinition>,
  metrics: TextMetrics,
): Readonly<SvgTextLayoutStyle> {
  return Object.freeze({
    alignment: definition.alignment,
    backgroundColor: definition.backgroundColor,
    cornerRadius: metrics.cornerRadius,
    font: definition.font,
    fontPercent: definition.fontPercent,
    fontSize: metrics.fontSize,
    lineHeight: metrics.lineHeight,
    padding: metrics.padding,
    textColor: definition.textColor,
  });
}

function segmentGraphemes(value: string): GraphemeSegment[] {
  const segments: GraphemeSegment[] = [];
  let current = "";
  let currentStart = 0;
  let joinNext = false;
  let offset = 0;

  for (const character of value) {
    const extendsCurrent =
      current !== "" &&
      (joinNext || character === "\u200d" || isGraphemeExtender(character));
    if (!extendsCurrent && current !== "") {
      segments.push({
        end: offset,
        segment: current,
        start: currentStart,
      });
      current = "";
    }
    if (current === "") currentStart = offset;
    current += character;
    joinNext = character === "\u200d";
    offset += character.length;
  }
  if (current !== "") {
    segments.push({ end: offset, segment: current, start: currentStart });
  }
  return segments;
}

function isGraphemeExtender(character: string): boolean {
  if (/\p{Mark}/u.test(character)) return true;
  const codePoint = character.codePointAt(0) ?? 0;
  return (
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef) ||
    (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff)
  );
}

function measureTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const character of text) {
    if (/\p{Mark}/u.test(character)) continue;
    if (/\s/u.test(character)) {
      units += 0.35;
      continue;
    }
    const codePoint = character.codePointAt(0) ?? 0;
    units += codePoint <= 0x7f ? 0.62 : 1;
  }
  return units * fontSize;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

function formatSvgNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
