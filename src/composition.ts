import { SvgTextExtension } from "./extension.js";
import {
  createSvgTextLayout,
  createSvgTextRichLayout,
  DEFAULT_SVG_TEXT_RICH_STYLE,
  DEFAULT_SVG_TEXT_STYLE,
  normalizeSvgTextColor,
  normalizeSvgTextFont,
  renderSvgTextRichLayout,
  type SvgTextAlignment,
  type SvgTextContentRun,
  type SvgTextLayout,
  type SvgTextNativeSize,
  type SvgTextRichLayout,
  type SvgTextRichStyleDefinition,
} from "./text-layout.js";

export type {
  SvgTextAlignment,
  SvgTextContentRubyRun,
  SvgTextContentRun,
  SvgTextContentTextRun,
  SvgTextLayout,
  SvgTextLayoutLine,
  SvgTextLayoutStyle,
  SvgTextNativeSize,
  SvgTextRevealUnit,
  SvgTextRichLayout,
  SvgTextRichLayoutFragment,
  SvgTextRichLayoutGlyph,
  SvgTextRichLayoutLine,
  SvgTextRichLayoutRubyFragment,
  SvgTextRichLayoutStyle,
  SvgTextRichLayoutTextFragment,
} from "./text-layout.js";

export interface SvgTextStyleInput {
  name: string;
  alignment?: SvgTextAlignment;
  backgroundColor?: string;
  font?: string;
  fontPercent?: number;
  rubyFontPercent?: number;
  rubyGap?: number;
  textColor?: string;
}

export interface SvgTextTarget {
  drawableID: number;
}

export interface SvgTextActorInput {
  styleName: string;
  target: SvgTextTarget;
  text: string;
}

export interface SvgTextCompositionRenderer {
  createSVGSkin(svg: string): number;
  destroySkin(skinId: number): void;
  getNativeSize?(): unknown;
  updateDrawableSkinId(drawableId: number, skinId: number): void;
}

export interface SvgTextCompositionRuntime {
  renderer: SvgTextCompositionRenderer;
  requestRedraw?(): void;
}

export interface SvgTextLayoutInput {
  nativeSize: SvgTextNativeSize;
  styleName: string;
  text: string;
}

export interface SvgTextRichLayoutInput {
  maxWidth?: number;
  nativeSize: SvgTextNativeSize;
  runs: readonly SvgTextContentRun[];
  styleName: string;
}

export interface SvgTextRichActorInput {
  maxWidth?: number;
  runs: readonly SvgTextContentRun[];
  styleName: string;
  target: SvgTextTarget;
}

export interface SvgTextRichMeasureInput {
  maxWidth?: number;
  runs: readonly SvgTextContentRun[];
  styleName: string;
}

export interface SvgTextLayoutComposition {
  defineStyle(input: SvgTextStyleInput): void;
  layoutRichText(input: SvgTextRichLayoutInput): SvgTextRichLayout;
  layoutText(input: SvgTextLayoutInput): SvgTextLayout;
}

export interface SvgTextComposition extends SvgTextLayoutComposition {
  measureRichText(input: SvgTextRichMeasureInput): number;
  measureText(input: SvgTextMeasureInput): number;
  releaseAll(): void;
  releaseTarget(target: SvgTextTarget): void;
  setRichText(input: SvgTextRichActorInput): void;
  setText(input: SvgTextActorInput): void;
}

export interface SvgTextMeasureInput {
  styleName: string;
  text: string;
}

export interface SvgTextCompositionOptions {
  runtime: SvgTextCompositionRuntime;
}

const defaultStyleName = "default";
const maximumContentCharacters = 100_000;
const maximumContentLines = 1000;
const maximumContentRuns = 1024;
const maximumLayoutFragments = 10_000;
const maximumLayoutWidth = 100_000;
const maximumRubyBaseCharacters = 256;
const maximumRubyReadingCharacters = 512;
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compositionError(code: string, message: string): Error {
  const error = new Error(message);
  Object.defineProperty(error, "code", { value: code });
  return error;
}

function requireExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  label: string,
): void {
  const allowed = new Set([...required, ...optional]);
  if (
    required.some((key) => !Object.prototype.hasOwnProperty.call(value, key)) ||
    Object.keys(value).some((key) => !allowed.has(key))
  ) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      `${label} has missing or unknown properties.`,
    );
  }
}

function requireName(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      `${label} must be a non-empty string.`,
    );
  }
  return value.trim();
}

function validateRuntime(value: unknown): SvgTextCompositionRuntime {
  if (!isRecord(value) || !isRecord(value.renderer)) {
    throw new TypeError(
      "SVG Text composition runtime must provide a renderer.",
    );
  }
  const renderer = value.renderer;
  const methods = ["createSVGSkin", "destroySkin", "updateDrawableSkinId"];
  if (methods.some((method) => typeof renderer[method] !== "function")) {
    throw new TypeError(
      `SVG Text composition renderer must provide ${methods.join(", ")}.`,
    );
  }
  if (
    value.requestRedraw !== undefined &&
    typeof value.requestRedraw !== "function"
  ) {
    throw new TypeError(
      "SVG Text composition requestRedraw must be a function.",
    );
  }
  return value as unknown as SvgTextCompositionRuntime;
}

function validateTarget(value: unknown): SvgTextTarget {
  if (
    !isRecord(value) ||
    typeof value.drawableID !== "number" ||
    !Number.isInteger(value.drawableID) ||
    value.drawableID < 0
  ) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-002",
      "SVG Text target must provide a non-negative integer drawableID.",
    );
  }
  return value as unknown as SvgTextTarget;
}

function validateOptionalString(value: unknown, label: string): void {
  if (
    value !== undefined &&
    (typeof value !== "string" || value.length === 0)
  ) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      `${label} must be a non-empty string when provided.`,
    );
  }
}

function validateStyle(value: unknown): SvgTextStyleInput & { name: string } {
  if (!isRecord(value)) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      "SVG Text style must be an object.",
    );
  }
  requireExactKeys(
    value,
    ["name"],
    [
      "alignment",
      "backgroundColor",
      "font",
      "fontPercent",
      "rubyFontPercent",
      "rubyGap",
      "textColor",
    ],
    "SVG Text style",
  );
  const name = requireName(value.name, "SVG Text style name");
  if (
    value.alignment !== undefined &&
    value.alignment !== "left" &&
    value.alignment !== "center" &&
    value.alignment !== "right"
  ) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      "SVG Text alignment is invalid.",
    );
  }
  validateOptionalString(value.backgroundColor, "SVG Text backgroundColor");
  validateOptionalString(value.font, "SVG Text font");
  validateOptionalString(value.textColor, "SVG Text textColor");
  if (
    value.fontPercent !== undefined &&
    (typeof value.fontPercent !== "number" ||
      !Number.isFinite(value.fontPercent) ||
      value.fontPercent < 1 ||
      value.fontPercent > 1000)
  ) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      "SVG Text fontPercent must be a finite number from 1 to 1000.",
    );
  }
  if (
    value.rubyFontPercent !== undefined &&
    (typeof value.rubyFontPercent !== "number" ||
      !Number.isFinite(value.rubyFontPercent) ||
      value.rubyFontPercent < 10 ||
      value.rubyFontPercent > 100)
  ) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      "SVG Text rubyFontPercent must be a finite number from 10 to 100.",
    );
  }
  if (
    value.rubyGap !== undefined &&
    (typeof value.rubyGap !== "number" ||
      !Number.isFinite(value.rubyGap) ||
      value.rubyGap < 0 ||
      value.rubyGap > 100)
  ) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      "SVG Text rubyGap must be a finite number from 0 to 100.",
    );
  }
  return { ...(value as unknown as SvgTextStyleInput), name };
}

function createStyleDefinition(
  style: SvgTextStyleInput,
): Readonly<SvgTextRichStyleDefinition> {
  return Object.freeze({
    alignment: style.alignment ?? DEFAULT_SVG_TEXT_STYLE.alignment,
    backgroundColor: normalizeSvgTextColor(
      style.backgroundColor ?? "",
      DEFAULT_SVG_TEXT_STYLE.backgroundColor,
    ),
    font: normalizeSvgTextFont(style.font ?? ""),
    fontPercent: style.fontPercent ?? DEFAULT_SVG_TEXT_STYLE.fontPercent,
    rubyFontPercent:
      style.rubyFontPercent ?? DEFAULT_SVG_TEXT_RICH_STYLE.rubyFontPercent,
    rubyGap: style.rubyGap ?? DEFAULT_SVG_TEXT_RICH_STYLE.rubyGap,
    textColor: normalizeSvgTextColor(
      style.textColor ?? "",
      DEFAULT_SVG_TEXT_STYLE.textColor,
    ),
  });
}

function validateNativeSize(value: unknown): SvgTextNativeSize {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    value.some(
      (dimension) =>
        typeof dimension !== "number" ||
        !Number.isFinite(dimension) ||
        dimension <= 0,
    )
  ) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      "SVG Text nativeSize must be [width, height] with two positive finite numbers.",
    );
  }
  return value as unknown as SvgTextNativeSize;
}

function getRuntimeNativeSize(
  renderer: SvgTextCompositionRenderer,
): SvgTextNativeSize {
  const value = renderer.getNativeSize?.();
  if (!Array.isArray(value) || value.length < 2) return [480, 360];
  const width = Number(value[0]);
  const height = Number(value[1]);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return [480, 360];
  }
  return [width, height];
}

function normalizeText(value: string): string {
  return value.replace(/\\r\\n|\\n|\\r/gu, "\n");
}

function normalizeRichText(value: string): string {
  return normalizeText(value.replace(/\r\n?|\n/gu, "\n"));
}

function contentLimitError(message: string): Error {
  return compositionError("SVG-TEXT-COMPOSITION-007", message);
}

function validateContentRuns(value: unknown): readonly SvgTextContentRun[] {
  if (!Array.isArray(value)) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      "SVG Text rich content runs must be an array.",
    );
  }
  if (value.length > maximumContentRuns) {
    throw contentLimitError(
      `SVG Text rich content exceeds ${maximumContentRuns} runs.`,
    );
  }

  let characterCount = 0;
  let fragmentCount = 0;
  let lineCount = 1;
  const runs = value.map((candidate, runIndex): SvgTextContentRun => {
    if (!isRecord(candidate)) {
      throw compositionError(
        "SVG-TEXT-COMPOSITION-001",
        `SVG Text rich content run ${runIndex} must be an object.`,
      );
    }

    if (candidate.type === "text") {
      requireExactKeys(
        candidate,
        ["type", "text"],
        [],
        `SVG Text rich content run ${runIndex}`,
      );
      if (typeof candidate.text !== "string") {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-001",
          `SVG Text rich content run ${runIndex} text must be a string.`,
        );
      }
      const text = normalizeRichText(candidate.text);
      characterCount += text.length;
      lineCount += text.split("\n").length - 1;
      fragmentCount += [...text.replace(/\n/gu, "")].length;
      return Object.freeze({ text, type: "text" });
    }

    if (candidate.type === "ruby") {
      requireExactKeys(
        candidate,
        ["type", "base", "reading"],
        [],
        `SVG Text rich content run ${runIndex}`,
      );
      if (
        typeof candidate.base !== "string" ||
        typeof candidate.reading !== "string"
      ) {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-001",
          `SVG Text rich content run ${runIndex} ruby base and reading must be strings.`,
        );
      }
      const base = normalizeRichText(candidate.base);
      const reading = normalizeRichText(candidate.reading);
      if (
        base.length === 0 ||
        reading.length === 0 ||
        base.includes("\n") ||
        reading.includes("\n")
      ) {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-001",
          `SVG Text rich content run ${runIndex} ruby base and reading must be non-empty single-line strings.`,
        );
      }
      if (base.length > maximumRubyBaseCharacters) {
        throw contentLimitError(
          `SVG Text ruby base exceeds ${maximumRubyBaseCharacters} characters.`,
        );
      }
      if (reading.length > maximumRubyReadingCharacters) {
        throw contentLimitError(
          `SVG Text ruby reading exceeds ${maximumRubyReadingCharacters} characters.`,
        );
      }
      characterCount += base.length + reading.length;
      fragmentCount += 1;
      return Object.freeze({ base, reading, type: "ruby" });
    }

    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      `SVG Text rich content run ${runIndex} type is invalid.`,
    );
  });

  if (characterCount > maximumContentCharacters) {
    throw contentLimitError(
      `SVG Text rich content exceeds ${maximumContentCharacters} characters.`,
    );
  }
  if (lineCount > maximumContentLines) {
    throw contentLimitError(
      `SVG Text rich content exceeds ${maximumContentLines} lines.`,
    );
  }
  if (fragmentCount > maximumLayoutFragments) {
    throw contentLimitError(
      `SVG Text rich content exceeds ${maximumLayoutFragments} layout fragments.`,
    );
  }
  return Object.freeze(runs);
}

function validateMaxWidth(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > maximumLayoutWidth
  ) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      `SVG Text maxWidth must be a finite number greater than 0 and no greater than ${maximumLayoutWidth}.`,
    );
  }
  return value;
}

function layoutTextFromStyles(
  styles: ReadonlyMap<string, Readonly<SvgTextRichStyleDefinition>>,
  input: unknown,
): SvgTextLayout {
  if (!isRecord(input)) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      "SVG Text layout input is invalid.",
    );
  }
  requireExactKeys(
    input,
    ["styleName", "text", "nativeSize"],
    [],
    "SVG Text layout input",
  );
  const styleName = requireName(input.styleName, "SVG Text styleName");
  const definition = styles.get(styleName);
  if (!definition) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-003",
      `SVG Text style is not defined: ${styleName}`,
    );
  }
  if (typeof input.text !== "string") {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      "SVG Text text must be a string.",
    );
  }
  return createSvgTextLayout(
    normalizeText(input.text),
    definition,
    validateNativeSize(input.nativeSize),
  );
}

function layoutRichTextFromStyles(
  styles: ReadonlyMap<string, Readonly<SvgTextRichStyleDefinition>>,
  input: unknown,
): SvgTextRichLayout {
  if (!isRecord(input)) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-001",
      "SVG Text rich layout input is invalid.",
    );
  }
  requireExactKeys(
    input,
    ["styleName", "runs", "nativeSize"],
    ["maxWidth"],
    "SVG Text rich layout input",
  );
  const styleName = requireName(input.styleName, "SVG Text styleName");
  const definition = styles.get(styleName);
  if (!definition) {
    throw compositionError(
      "SVG-TEXT-COMPOSITION-003",
      `SVG Text style is not defined: ${styleName}`,
    );
  }
  const runs = validateContentRuns(input.runs);
  const nativeSize = validateNativeSize(input.nativeSize);
  const maxWidth = validateMaxWidth(input.maxWidth);
  return maxWidth === undefined
    ? createSvgTextRichLayout(runs, definition, nativeSize)
    : createSvgTextRichLayout(runs, definition, nativeSize, maxWidth);
}

export function createSvgTextLayoutComposition(): SvgTextLayoutComposition {
  const styles = new Map<string, Readonly<SvgTextRichStyleDefinition>>([
    [defaultStyleName, DEFAULT_SVG_TEXT_RICH_STYLE],
  ]);

  return Object.freeze({
    defineStyle(input: SvgTextStyleInput): void {
      const style = validateStyle(input);
      styles.set(style.name, createStyleDefinition(style));
    },
    layoutRichText(input: SvgTextRichLayoutInput): SvgTextRichLayout {
      return layoutRichTextFromStyles(styles, input);
    },
    layoutText(input: SvgTextLayoutInput): SvgTextLayout {
      return layoutTextFromStyles(styles, input);
    },
  });
}

export function createSvgTextComposition(
  options: SvgTextCompositionOptions,
): SvgTextComposition {
  if (!isRecord(options)) {
    throw new TypeError("SVG Text composition options must be an object.");
  }
  const runtime = validateRuntime(options.runtime);
  const extension = new SvgTextExtension(
    runtime as unknown as TurboWarpRuntime,
    {
      castToString: (value) => String(value),
      listenForRuntimeEvents: false,
    },
  );
  const styles = new Map<string, Readonly<SvgTextRichStyleDefinition>>([
    [defaultStyleName, DEFAULT_SVG_TEXT_RICH_STYLE],
  ]);
  const targets = new Set<SvgTextTarget>();
  let disposed = false;

  function ensureActive(): void {
    if (disposed) {
      throw compositionError(
        "SVG-TEXT-COMPOSITION-004",
        "SVG Text composition has been released.",
      );
    }
  }

  const composition: SvgTextComposition = {
    defineStyle(input) {
      ensureActive();
      const style = validateStyle(input);
      extension.defineStyle({
        ALIGN: style.alignment ?? "",
        BACKGROUND: style.backgroundColor ?? "",
        FONT: style.font ?? "",
        RUBY_GAP: style.rubyGap ?? "",
        RUBY_SIZE: style.rubyFontPercent ?? "",
        SIZE: style.fontPercent ?? "",
        STYLE: style.name,
        TEXT_COLOR: style.textColor ?? "",
      });
      styles.set(style.name, createStyleDefinition(style));
    },

    layoutRichText(input) {
      ensureActive();
      return layoutRichTextFromStyles(styles, input);
    },

    layoutText(input) {
      ensureActive();
      return layoutTextFromStyles(styles, input);
    },

    measureText(input) {
      ensureActive();
      if (!isRecord(input)) {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-001",
          "SVG Text measure input is invalid.",
        );
      }
      requireExactKeys(
        input,
        ["styleName", "text"],
        [],
        "SVG Text measure input",
      );
      const styleName = requireName(input.styleName, "SVG Text styleName");
      if (!styles.has(styleName)) {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-003",
          `SVG Text style is not defined: ${styleName}`,
        );
      }
      if (typeof input.text !== "string") {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-001",
          "SVG Text text must be a string.",
        );
      }
      return extension.measureText(styleName, input.text);
    },

    measureRichText(input) {
      ensureActive();
      if (!isRecord(input)) {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-001",
          "SVG Text rich measure input is invalid.",
        );
      }
      requireExactKeys(
        input,
        ["styleName", "runs"],
        ["maxWidth"],
        "SVG Text rich measure input",
      );
      const styleName = requireName(input.styleName, "SVG Text styleName");
      const definition = styles.get(styleName);
      if (!definition) {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-003",
          `SVG Text style is not defined: ${styleName}`,
        );
      }
      const runs = validateContentRuns(input.runs);
      const maxWidth = validateMaxWidth(input.maxWidth);
      const nativeSize = getRuntimeNativeSize(runtime.renderer);
      const layout =
        maxWidth === undefined
          ? createSvgTextRichLayout(runs, definition, nativeSize)
          : createSvgTextRichLayout(runs, definition, nativeSize, maxWidth);
      return Math.max(0, ...layout.lines.map((line) => line.width));
    },

    setRichText(input) {
      ensureActive();
      if (!isRecord(input)) {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-001",
          "SVG Text rich actor input is invalid.",
        );
      }
      requireExactKeys(
        input,
        ["styleName", "target", "runs"],
        ["maxWidth"],
        "SVG Text rich actor input",
      );
      const target = validateTarget(input.target);
      const styleName = requireName(input.styleName, "SVG Text styleName");
      if (!styles.has(styleName)) {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-003",
          `SVG Text style is not defined: ${styleName}`,
        );
      }
      const runs = validateContentRuns(input.runs);
      const maxWidth = validateMaxWidth(input.maxWidth);
      extension.setCompositionText(
        styleName,
        (definition, nativeSize) => {
          const layout =
            maxWidth === undefined
              ? createSvgTextRichLayout(runs, definition, nativeSize)
              : createSvgTextRichLayout(runs, definition, nativeSize, maxWidth);
          return renderSvgTextRichLayout(layout);
        },
        target,
      );
      targets.add(target);
    },

    setText(input) {
      ensureActive();
      if (!isRecord(input)) {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-001",
          "SVG Text actor input is invalid.",
        );
      }
      requireExactKeys(
        input,
        ["styleName", "target", "text"],
        [],
        "SVG Text actor input",
      );
      const target = validateTarget(input.target);
      const styleName = requireName(input.styleName, "SVG Text styleName");
      if (!styles.has(styleName)) {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-003",
          `SVG Text style is not defined: ${styleName}`,
        );
      }
      if (typeof input.text !== "string") {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-001",
          "SVG Text text must be a string.",
        );
      }
      extension.setText({ STYLE: styleName, TEXT: input.text }, { target });
      targets.add(target);
    },

    releaseTarget(value) {
      ensureActive();
      const target = validateTarget(value);
      if (!targets.delete(target)) {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-005",
          "SVG Text target is not owned by this composition.",
        );
      }
      if (!extension.releaseTextActor(target)) {
        throw compositionError(
          "SVG-TEXT-COMPOSITION-005",
          "SVG Text target ownership is inconsistent.",
        );
      }
    },

    releaseAll() {
      if (disposed) return;
      disposed = true;
      const errors: unknown[] = [];
      for (const target of targets) {
        try {
          extension.releaseTextActor(target);
        } catch (error) {
          errors.push(error);
        }
      }
      targets.clear();
      styles.clear();
      if (errors.length > 0) {
        const error = compositionError(
          "SVG-TEXT-COMPOSITION-006",
          "SVG Text composition failed to release one or more skins.",
        );
        Object.defineProperty(error, "errors", {
          value: Object.freeze([...errors]),
        });
        throw error;
      }
    },
  };

  return Object.freeze(composition);
}
