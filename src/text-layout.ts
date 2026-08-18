export type SvgTextAlignment = "center" | "left" | "right";

export interface SvgTextStyleDefinition {
  alignment: SvgTextAlignment;
  backgroundColor: string;
  font: string;
  fontPercent: number;
  textColor: string;
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

const baseStageWidth = 480;
const baseStageHeight = 360;
const defaultFontPercent = 100;
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

export function createSvgTextLayout(
  text: string,
  definition: Readonly<SvgTextStyleDefinition>,
  nativeSize: SvgTextNativeSize,
): SvgTextLayout {
  const stageScale = Math.min(
    nativeSize[0] / baseStageWidth,
    nativeSize[1] / baseStageHeight,
  );
  const fontScale = stageScale * (definition.fontPercent / defaultFontPercent);
  const fontSize = textStyle.fontSize * fontScale;
  const lineHeight = textStyle.lineHeight * fontScale;
  const padding = textStyle.padding * stageScale;
  const cornerRadius = textStyle.cornerRadius * stageScale;
  const lineMeasurements = text.split("\n").map((line) => ({
    text: line,
    width: measureTextWidth(line, fontSize),
  }));
  const contentWidth = Math.max(
    1,
    ...lineMeasurements.map((line) => line.width),
  );
  const width = Math.max(1, Math.ceil(contentWidth + padding * 2));
  const height = Math.max(
    1,
    Math.ceil(lineHeight * lineMeasurements.length + padding * 2),
  );
  const x =
    definition.alignment === "center"
      ? width / 2
      : definition.alignment === "right"
        ? width - padding
        : padding;
  const lines = Object.freeze(
    lineMeasurements.map((line, index) =>
      Object.freeze({
        baseline: padding + fontSize + lineHeight * index,
        text: line.text,
        width: line.width,
        x,
      }),
    ),
  );
  const style = Object.freeze({
    alignment: definition.alignment,
    backgroundColor: definition.backgroundColor,
    cornerRadius,
    font: definition.font,
    fontPercent: definition.fontPercent,
    fontSize,
    lineHeight,
    padding,
    textColor: definition.textColor,
  });

  return Object.freeze({
    height,
    lines,
    preserveWhitespace: true,
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
