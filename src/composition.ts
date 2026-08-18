import { SvgTextExtension } from "./extension.js";
import {
  createSvgTextLayout,
  DEFAULT_SVG_TEXT_STYLE,
  normalizeSvgTextColor,
  normalizeSvgTextFont,
  type SvgTextAlignment,
  type SvgTextLayout,
  type SvgTextNativeSize,
  type SvgTextStyleDefinition,
} from "./text-layout.js";

export type {
  SvgTextAlignment,
  SvgTextLayout,
  SvgTextLayoutLine,
  SvgTextLayoutStyle,
  SvgTextNativeSize,
} from "./text-layout.js";

export interface SvgTextStyleInput {
  name: string;
  alignment?: SvgTextAlignment;
  backgroundColor?: string;
  font?: string;
  fontPercent?: number;
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

export interface SvgTextLayoutComposition {
  defineStyle(input: SvgTextStyleInput): void;
  layoutText(input: SvgTextLayoutInput): SvgTextLayout;
}

export interface SvgTextComposition extends SvgTextLayoutComposition {
  measureText(input: SvgTextMeasureInput): number;
  releaseAll(): void;
  releaseTarget(target: SvgTextTarget): void;
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
    ["alignment", "backgroundColor", "font", "fontPercent", "textColor"],
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
  return { ...(value as unknown as SvgTextStyleInput), name };
}

function createStyleDefinition(
  style: SvgTextStyleInput,
): Readonly<SvgTextStyleDefinition> {
  return Object.freeze({
    alignment: style.alignment ?? DEFAULT_SVG_TEXT_STYLE.alignment,
    backgroundColor: normalizeSvgTextColor(
      style.backgroundColor ?? "",
      DEFAULT_SVG_TEXT_STYLE.backgroundColor,
    ),
    font: normalizeSvgTextFont(style.font ?? ""),
    fontPercent: style.fontPercent ?? DEFAULT_SVG_TEXT_STYLE.fontPercent,
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

function normalizeText(value: string): string {
  return value.replace(/\\r\\n|\\n|\\r/gu, "\n");
}

function layoutTextFromStyles(
  styles: ReadonlyMap<string, Readonly<SvgTextStyleDefinition>>,
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

export function createSvgTextLayoutComposition(): SvgTextLayoutComposition {
  const styles = new Map<string, Readonly<SvgTextStyleDefinition>>([
    [defaultStyleName, DEFAULT_SVG_TEXT_STYLE],
  ]);

  return Object.freeze({
    defineStyle(input: SvgTextStyleInput): void {
      const style = validateStyle(input);
      styles.set(style.name, createStyleDefinition(style));
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
  const styles = new Map<string, Readonly<SvgTextStyleDefinition>>([
    [defaultStyleName, DEFAULT_SVG_TEXT_STYLE],
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
        SIZE: style.fontPercent ?? "",
        STYLE: style.name,
        TEXT_COLOR: style.textColor ?? "",
      });
      styles.set(style.name, createStyleDefinition(style));
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
