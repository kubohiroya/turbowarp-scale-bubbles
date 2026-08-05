import definitions from "./block-definitions.json";
import { extensionConfig } from "./config.js";

type BlockTypeName = "COMMAND";
type ArgumentTypeName = "COLOR" | "NUMBER" | "STRING";
type TextAlignment = "center" | "left" | "right";
const bubbleDirections = [
  "up",
  "up-up-right",
  "up-right",
  "right-up-right",
  "right",
  "right-down-right",
  "down-right",
  "down-down-right",
  "down",
  "down-down-left",
  "down-left",
  "left-down-left",
  "left",
  "left-up-left",
  "up-left",
  "up-up-left",
] as const;
type CanonicalBubbleDirection = (typeof bubbleDirections)[number];
type BubbleDirection = CanonicalBubbleDirection | number;

const bubbleDirectionAliases = new Map<string, CanonicalBubbleDirection>([
  ["east", "right"],
  ["east-northeast", "right-up-right"],
  ["east-southeast", "right-down-right"],
  ["north", "up"],
  ["northeast", "up-right"],
  ["north-northeast", "up-up-right"],
  ["northwest", "up-left"],
  ["north-northwest", "up-up-left"],
  ["south", "down"],
  ["southeast", "down-right"],
  ["south-southeast", "down-down-right"],
  ["southwest", "down-left"],
  ["south-southwest", "down-down-left"],
  ["west", "left"],
  ["west-northwest", "left-up-left"],
  ["west-southwest", "left-down-left"],
]);

const intermediateDirectionOffset = Math.SQRT2 - 1;
interface BubbleDirectionVector {
  x: number;
  y: number;
}
const bubbleDirectionVectors: Readonly<
  Record<CanonicalBubbleDirection, Readonly<BubbleDirectionVector>>
> = {
  down: { x: 0, y: -1 },
  "down-down-left": { x: -intermediateDirectionOffset, y: -1 },
  "down-down-right": { x: intermediateDirectionOffset, y: -1 },
  "down-left": { x: -1, y: -1 },
  "down-right": { x: 1, y: -1 },
  left: { x: -1, y: 0 },
  "left-down-left": { x: -1, y: -intermediateDirectionOffset },
  "left-up-left": { x: -1, y: intermediateDirectionOffset },
  right: { x: 1, y: 0 },
  "right-down-right": { x: 1, y: -intermediateDirectionOffset },
  "right-up-right": { x: 1, y: intermediateDirectionOffset },
  up: { x: 0, y: 1 },
  "up-left": { x: -1, y: 1 },
  "up-right": { x: 1, y: 1 },
  "up-up-left": { x: -intermediateDirectionOffset, y: 1 },
  "up-up-right": { x: intermediateDirectionOffset, y: 1 },
};

function normalizeVectorComponent(value: number): number {
  if (Math.abs(value) < 1e-12) return 0;
  if (Math.abs(1 - Math.abs(value)) < 1e-12) return Math.sign(value);
  return value;
}

function directionVector(direction: BubbleDirection): BubbleDirectionVector {
  if (typeof direction === "string") return bubbleDirectionVectors[direction];
  const radians = (direction * Math.PI) / 180;
  const rawX = Math.sin(radians);
  const rawY = Math.cos(radians);
  return {
    x: normalizeVectorComponent(rawX),
    y: normalizeVectorComponent(rawY),
  };
}

interface DefinitionArgument {
  type: ArgumentTypeName;
  defaultValue: number | string;
  menu?: string;
}

interface BlockDefinition {
  opcode: string;
  blockType: BlockTypeName;
  text: string;
  description: string;
  hideFromPalette?: boolean;
  arguments: Record<string, DefinitionArgument>;
}

interface DefinitionMenu {
  acceptReporters: boolean;
  items: string[];
}

interface LegacyBubbleArguments {
  MESSAGE: unknown;
  SIZE: unknown;
}

interface StyledBubbleArguments {
  MESSAGE: unknown;
  STYLE: unknown;
}

interface TextActorArguments {
  STYLE: unknown;
  TEXT: unknown;
}

interface DefineStyleArguments {
  ALIGN: unknown;
  BACKGROUND: unknown;
  DIRECTION: unknown;
  FONT: unknown;
  SIZE: unknown;
  STYLE: unknown;
  TEXT_COLOR: unknown;
}

interface BlockUtility {
  target: TurboWarpTarget;
}

interface BubbleStyleDefinition {
  alignment: TextAlignment;
  backgroundColor: string;
  direction: BubbleDirection;
  font: string;
  fontPercent: number;
  textColor: string;
}

interface BubbleStyleSelection {
  definition: BubbleStyleDefinition;
  styleName: string | null;
}

interface TextActorState {
  skinId: number;
  styleName: string;
  text: string;
}

interface SvgTextExtensionOptions {
  castToString?: (value: unknown) => string;
  listenForRuntimeEvents?: boolean;
}

const blockDefinitions = definitions.blocks as readonly BlockDefinition[];
const definitionMenus = definitions.menus as Record<string, DefinitionMenu>;
export const EXTENSION_DOCS_URI =
  "https://kubohiroya.github.io/turbowarp-svg-text/";
const bubbleStateKey = "Scratch.looks";
const defaultStyleName = "default";
const defaultFontPercent = 100;
const minimumFontPercent = 1;
const maximumFontPercent = 1000;
const maximumFontNameLength = 128;
const baseStageWidth = 480;
const baseStageHeight = 360;
const baseStyle = {
  maxLineWidth: 170,
  minWidth: 50,
  strokeWidth: 4,
  padding: 10,
  cornerRadius: 16,
  tailHeight: 12,
  fontSize: 14,
  fontHeightRatio: 0.9,
  lineHeight: 16,
} as const;
const actorStyle = {
  minimumWidth: 1,
  padding: 12,
  cornerRadius: 8,
} as const;
const initialDefaultStyle: BubbleStyleDefinition = {
  alignment: "left",
  backgroundColor: "#ffffff",
  direction: "up-right",
  font: "Helvetica",
  fontPercent: defaultFontPercent,
  textColor: "#575e75",
};

export class SvgTextExtension implements TurboWarpExtension {
  private readonly runtime: TurboWarpRuntime;
  private readonly castToString: (value: unknown) => string;
  private readonly styles = new Map<string, BubbleStyleDefinition>([
    [defaultStyleName, initialDefaultStyle],
  ]);
  private readonly activeStyles = new WeakMap<
    TurboWarpTarget,
    BubbleStyleSelection
  >();
  private readonly textActors = new Map<TurboWarpTarget, TextActorState>();
  private readonly pendingStyles = new WeakMap<
    TurboWarpTarget,
    BubbleStyleSelection
  >();
  private readonly alignedSkins = new WeakSet<TextBubbleSkin>();
  private readonly targetPositionHooks = new WeakMap<
    TurboWarpTarget,
    (target: TurboWarpTarget) => void
  >();

  public constructor(
    runtime = Scratch.vm?.runtime,
    options: SvgTextExtensionOptions = {},
  ) {
    if (!runtime) throw new Error("SVG Text requires the TurboWarp VM.");
    this.runtime = runtime;
    this.castToString = options.castToString ?? Scratch.Cast.toString;
    this.handleSayOrThink = this.handleSayOrThink.bind(this);
    this.handleStageSizeChanged = this.handleStageSizeChanged.bind(this);
    if (options.listenForRuntimeEvents ?? true) {
      this.runtime.on("SAY", this.handleSayOrThink);
      this.runtime.on("STAGE_SIZE_CHANGED", this.handleStageSizeChanged);
    }
  }

  public getInfo(): Record<string, unknown> {
    return {
      id: extensionConfig.id,
      name: Scratch.translate(definitions.extensionName),
      docsURI: EXTENSION_DOCS_URI,
      color1: "#9966ff",
      blocks: blockDefinitions.map((block) => this.toScratchBlock(block)),
      menus: definitionMenus,
    };
  }

  public defineStyle(args: DefineStyleArguments): void {
    const styleName = this.normalizeStyleName(args.STYLE);
    const definition: BubbleStyleDefinition = {
      alignment: this.normalizeAlignment(args.ALIGN),
      backgroundColor: this.normalizeColor(
        args.BACKGROUND,
        initialDefaultStyle.backgroundColor,
      ),
      direction: this.normalizeDirection(args.DIRECTION),
      font: this.normalizeFont(args.FONT),
      fontPercent: this.normalizeFontPercent(args.SIZE),
      textColor: this.normalizeColor(
        args.TEXT_COLOR,
        initialDefaultStyle.textColor,
      ),
    };
    this.styles.set(styleName, definition);
    this.restyleVisibleBubbles(styleName, definition);
    this.restyleTextActors(styleName);
  }

  public setText(args: TextActorArguments, util: BlockUtility): void {
    const selection = this.resolveStyle(args.STYLE);
    this.applyTextActor(
      util.target,
      this.normalizeMessage(args.TEXT),
      selection,
    );
  }

  public releaseTextActor(target: TurboWarpTarget): boolean {
    const state = this.textActors.get(target);
    if (!state) return false;
    this.textActors.delete(target);
    this.runtime.renderer?.destroySkin?.(state.skinId);
    this.runtime.requestRedraw?.();
    return true;
  }

  public sayWithStyle(args: StyledBubbleArguments, util: BlockUtility): void {
    this.showStyledBubble("say", args, util);
  }

  public thinkWithStyle(args: StyledBubbleArguments, util: BlockUtility): void {
    this.showStyledBubble("think", args, util);
  }

  public say(args: LegacyBubbleArguments, util: BlockUtility): void {
    this.showLegacyBubble("say", args, util);
  }

  public think(args: LegacyBubbleArguments, util: BlockUtility): void {
    this.showLegacyBubble("think", args, util);
  }

  private toScratchBlock(block: BlockDefinition): Record<string, unknown> {
    return {
      opcode: block.opcode,
      blockType: Scratch.BlockType[block.blockType],
      text: Scratch.translate(block.text),
      hideFromPalette: block.hideFromPalette ?? false,
      arguments: Object.fromEntries(
        Object.entries(block.arguments).map(([name, argument]) => [
          name,
          {
            type: Scratch.ArgumentType[argument.type],
            defaultValue: argument.defaultValue,
            ...(argument.menu === undefined ? {} : { menu: argument.menu }),
          },
        ]),
      ),
    };
  }

  private normalizeStyleName(value: unknown): string {
    const styleName = this.castToString(value).trim();
    return styleName || defaultStyleName;
  }

  private normalizeFontPercent(value: unknown): number {
    if (typeof value === "string" && value.trim() === "")
      return defaultFontPercent;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return defaultFontPercent;
    return Math.min(
      maximumFontPercent,
      Math.max(minimumFontPercent, numericValue),
    );
  }

  private normalizeMessage(value: unknown): string {
    return this.castToString(value).replace(/\\r\\n|\\n|\\r/gu, "\n");
  }

  private normalizeAlignment(value: unknown): TextAlignment {
    const alignment = this.castToString(value).trim().toLowerCase();
    if (alignment === "center" || alignment === "right") return alignment;
    return "left";
  }

  private normalizeDirection(value: unknown): BubbleDirection {
    const direction = this.castToString(value).trim().toLowerCase();
    if (bubbleDirections.includes(direction as CanonicalBubbleDirection)) {
      return direction as CanonicalBubbleDirection;
    }
    const alias = bubbleDirectionAliases.get(direction);
    if (alias) return alias;
    if (direction !== "") {
      const degrees = Number(direction);
      if (Number.isFinite(degrees) && degrees >= 0 && degrees <= 360) {
        return degrees === 360 ? 0 : degrees;
      }
    }
    return initialDefaultStyle.direction;
  }

  private normalizeColor(value: unknown, fallback: string): string {
    const color = this.castToString(value).trim();
    if (color === "") return fallback;
    if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/iu.test(color)) {
      return color;
    }
    if (globalThis.CSS?.supports?.("color", color)) return color;
    return fallback;
  }

  private normalizeFont(value: unknown): string {
    const font = this.castToString(value).trim();
    const hasUnsafeCharacter = [...font].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127 || ",;{}".includes(character);
    });
    if (
      font === "" ||
      font.length > maximumFontNameLength ||
      hasUnsafeCharacter
    ) {
      return initialDefaultStyle.font;
    }
    return font;
  }

  private getStageScale(): number {
    const nativeSize = this.runtime.renderer?.getNativeSize?.();
    if (!Array.isArray(nativeSize) || nativeSize.length < 2) return 1;
    const width = Number(nativeSize[0]);
    const height = Number(nativeSize[1]);
    if (!(width > 0) || !(height > 0)) return 1;
    return Math.min(width / baseStageWidth, height / baseStageHeight);
  }

  private createRenderStyle(
    definition: BubbleStyleDefinition,
  ): TextBubbleRenderStyle {
    const stageScale = this.getStageScale();
    const fontScale =
      stageScale * (definition.fontPercent / defaultFontPercent);
    return {
      maxLineWidth: baseStyle.maxLineWidth * stageScale,
      minWidth: baseStyle.minWidth * stageScale,
      strokeWidth: baseStyle.strokeWidth * stageScale,
      padding: baseStyle.padding * stageScale,
      cornerRadius: baseStyle.cornerRadius * stageScale,
      tailHeight: baseStyle.tailHeight * stageScale,
      font: definition.font,
      fontSize: baseStyle.fontSize * fontScale,
      fontHeightRatio: baseStyle.fontHeightRatio,
      lineHeight: baseStyle.lineHeight * fontScale,
      bubbleFill: definition.backgroundColor,
      textFill: definition.textColor,
      textAlign: definition.alignment,
    };
  }

  private createTextActorSvg(
    text: string,
    definition: BubbleStyleDefinition,
  ): string {
    const stageScale = this.getStageScale();
    const fontScale =
      stageScale * (definition.fontPercent / defaultFontPercent);
    const fontSize = baseStyle.fontSize * fontScale;
    const lineHeight = baseStyle.lineHeight * fontScale;
    const padding = actorStyle.padding * stageScale;
    const cornerRadius = actorStyle.cornerRadius * stageScale;
    const lines = text.split("\n");
    const contentWidth = Math.max(
      actorStyle.minimumWidth,
      ...lines.map((line) => this.measureTextWidth(line, fontSize)),
    );
    const width = Math.max(1, Math.ceil(contentWidth + padding * 2));
    const height = Math.max(
      1,
      Math.ceil(lineHeight * lines.length + padding * 2),
    );
    const alignment = definition.alignment;
    const textAnchor =
      alignment === "center"
        ? "middle"
        : alignment === "right"
          ? "end"
          : "start";
    const x =
      alignment === "center"
        ? width / 2
        : alignment === "right"
          ? width - padding
          : padding;
    const title = this.escapeXml(text);
    const tspans = lines
      .map((line, index) => {
        const y = padding + fontSize + lineHeight * index;
        return `<tspan x="${this.formatSvgNumber(x)}" y="${this.formatSvgNumber(y)}">${this.escapeXml(line)}</tspan>`;
      })
      .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${title}</title><rect width="${width}" height="${height}" rx="${this.formatSvgNumber(cornerRadius)}" fill="${this.escapeXml(definition.backgroundColor)}"/><text xml:space="preserve" fill="${this.escapeXml(definition.textColor)}" font-family="${this.escapeXml(definition.font)}" font-size="${this.formatSvgNumber(fontSize)}" text-anchor="${textAnchor}">${tspans}</text></svg>`;
  }

  private measureTextWidth(text: string, fontSize: number): number {
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

  private escapeXml(value: string): string {
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

  private formatSvgNumber(value: number): string {
    return String(Math.round(value * 1000) / 1000);
  }

  private applyTextActor(
    target: TurboWarpTarget,
    text: string,
    selection: BubbleStyleSelection,
  ): void {
    const renderer = this.runtime.renderer;
    if (
      typeof target.drawableID !== "number" ||
      typeof renderer?.createSVGSkin !== "function" ||
      typeof renderer.updateDrawableSkinId !== "function"
    ) {
      throw new Error("SVG Text requires SVG skin APIs from TurboWarp.");
    }

    const skinId = renderer.createSVGSkin(
      this.createTextActorSvg(text, selection.definition),
    );
    if (!Number.isInteger(skinId) || skinId < 0) {
      throw new Error("TurboWarp did not create an SVG text skin.");
    }

    try {
      renderer.updateDrawableSkinId(target.drawableID, skinId);
    } catch (error) {
      renderer.destroySkin?.(skinId);
      throw error;
    }

    const previous = this.textActors.get(target);
    this.textActors.set(target, {
      skinId,
      styleName: selection.styleName ?? defaultStyleName,
      text,
    });
    if (previous && previous.skinId !== skinId) {
      renderer.destroySkin?.(previous.skinId);
    }
    this.runtime.requestRedraw?.();
  }

  private resolveStyle(value: unknown): BubbleStyleSelection {
    const requestedName = this.normalizeStyleName(value);
    const definition = this.styles.get(requestedName);
    if (definition) return { definition, styleName: requestedName };
    return {
      definition: this.styles.get(defaultStyleName) ?? initialDefaultStyle,
      styleName: defaultStyleName,
    };
  }

  private getBubbleState(target: TurboWarpTarget): TextBubbleState | null {
    const state = target.getCustomState?.(bubbleStateKey);
    if (!state || typeof state !== "object") return null;
    return state as TextBubbleState;
  }

  private getTextBubbleSkin(skinId: number): TextBubbleSkin | null {
    const skins = this.runtime.renderer?._allSkins;
    if (!skins) return null;
    return (skins instanceof Map ? skins.get(skinId) : skins[skinId]) ?? null;
  }

  private installAlignmentRenderer(skin: TextBubbleSkin): void {
    if (this.alignedSkins.has(skin)) return;
    const originalRender = skin._renderTextBubble;
    if (typeof originalRender !== "function") return;

    skin._renderTextBubble = function renderAlignedTextBubble(scale): void {
      const style = this._style;
      const alignment = style?.textAlign;
      const textFill = style?.textFill;
      if (
        !style ||
        (alignment !== "center" && alignment !== "right") ||
        typeof textFill !== "string"
      ) {
        originalRender.call(this, scale);
        return;
      }

      style.textFill = "transparent";
      try {
        originalRender.call(this, scale);
      } finally {
        style.textFill = textFill;
      }

      const context = this._canvas?.getContext("2d");
      const lines = this._lines;
      const width = this._textAreaSize?.width;
      const padding = style.padding;
      const lineHeight = style.lineHeight;
      const fontHeightRatio = style.fontHeightRatio;
      const fontSize = style.fontSize;
      if (
        !context ||
        !lines ||
        typeof width !== "number" ||
        typeof padding !== "number" ||
        typeof lineHeight !== "number" ||
        typeof fontHeightRatio !== "number" ||
        typeof fontSize !== "number"
      ) {
        return;
      }

      context.save();
      context.fillStyle = textFill;
      context.textAlign = alignment;
      const x = alignment === "center" ? width / 2 : width - padding;
      for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
        const line = lines[lineNumber];
        if (line === undefined) continue;
        context.fillText(
          line,
          x,
          padding + lineHeight * lineNumber + fontHeightRatio * fontSize,
        );
      }
      context.restore();
    };
    this.alignedSkins.add(skin);
  }

  private installTargetPositionHook(target: TurboWarpTarget): void {
    const currentHook = target.onTargetVisualChange;
    if (currentHook === this.targetPositionHooks.get(target)) return;
    const originalHook =
      typeof currentHook === "function" ? currentHook : undefined;
    const positionHook = (changedTarget: TurboWarpTarget): void => {
      originalHook?.(changedTarget);
      this.positionBubble(target);
    };
    this.targetPositionHooks.set(target, positionHook);
    target.onTargetVisualChange = positionHook;
  }

  private positionBubble(target: TurboWarpTarget): void {
    if (target.visible === false) return;
    const bubbleState = this.getBubbleState(target);
    const renderer = this.runtime.renderer;
    if (
      !bubbleState ||
      typeof bubbleState.drawableId !== "number" ||
      typeof renderer?.getCurrentSkinSize !== "function" ||
      typeof renderer.updateDrawablePosition !== "function"
    ) {
      return;
    }

    const size = renderer.getCurrentSkinSize(bubbleState.drawableId);
    if (!Array.isArray(size) || size.length < 2) return;
    const bubbleWidth = Number(size[0]);
    const bubbleHeight = Number(size[1]);
    if (!(bubbleWidth > 0) || !(bubbleHeight > 0)) return;

    let targetBounds: TurboWarpBounds;
    try {
      targetBounds = target.getBoundsForBubble?.() ?? {
        bottom: target.y ?? 0,
        left: target.x ?? 0,
        right: target.x ?? 0,
        top: target.y ?? 0,
      };
    } catch {
      targetBounds = {
        bottom: target.y ?? 0,
        left: target.x ?? 0,
        right: target.x ?? 0,
        top: target.y ?? 0,
      };
    }

    const nativeSize = renderer.getNativeSize?.();
    if (!Array.isArray(nativeSize) || nativeSize.length < 2) return;
    const stageWidth = Number(nativeSize[0]);
    const stageHeight = Number(nativeSize[1]);
    if (!(stageWidth > 0) || !(stageHeight > 0)) return;

    const direction =
      this.activeStyles.get(target)?.definition.direction ??
      initialDefaultStyle.direction;
    const centerX = (targetBounds.left + targetBounds.right) / 2;
    const centerY = (targetBounds.top + targetBounds.bottom) / 2;
    const gap = baseStyle.tailHeight * this.getStageScale();
    const centeredBubbleX = centerX - bubbleWidth / 2;
    const centeredBubbleY = centerY + bubbleHeight / 2;
    const leftBubbleX = targetBounds.left - gap - bubbleWidth;
    const rightBubbleX = targetBounds.right + gap;
    const upperBubbleY = targetBounds.top + gap + bubbleHeight;
    const lowerBubbleY = targetBounds.bottom - gap;
    const vector = directionVector(direction);
    const horizontalDistance =
      vector.x < 0
        ? centeredBubbleX - leftBubbleX
        : rightBubbleX - centeredBubbleX;
    const verticalDistance =
      vector.y < 0
        ? centeredBubbleY - lowerBubbleY
        : upperBubbleY - centeredBubbleY;
    const placementScale = Math.min(
      vector.x === 0
        ? Number.POSITIVE_INFINITY
        : horizontalDistance / Math.abs(vector.x),
      vector.y === 0
        ? Number.POSITIVE_INFINITY
        : verticalDistance / Math.abs(vector.y),
    );
    let x = centeredBubbleX + vector.x * placementScale;
    let y = centeredBubbleY + vector.y * placementScale;

    if (vector.x > 0 && !bubbleState.onSpriteRight) {
      bubbleState.onSpriteRight = true;
      this.updateTextSkin(bubbleState);
    } else if (vector.x < 0 && bubbleState.onSpriteRight) {
      bubbleState.onSpriteRight = false;
      this.updateTextSkin(bubbleState);
    }

    const stageLeft = -stageWidth / 2;
    const stageRight = stageWidth / 2;
    const stageTop = stageHeight / 2;
    const stageBottom = -stageHeight / 2;
    x = this.clampPosition(x, stageLeft, stageRight - bubbleWidth);
    y = this.clampPosition(y, stageBottom + bubbleHeight, stageTop);
    renderer.updateDrawablePosition(bubbleState.drawableId, [x, y]);
  }

  private updateTextSkin(bubbleState: TextBubbleState): void {
    if (typeof bubbleState.skinId !== "number") return;
    this.runtime.renderer?.updateTextSkin?.(
      bubbleState.skinId,
      bubbleState.type,
      bubbleState.text,
      bubbleState.onSpriteRight,
      [0, 0],
    );
  }

  private clampPosition(
    value: number,
    minimum: number,
    maximum: number,
  ): number {
    if (maximum < minimum) return minimum;
    return Math.min(maximum, Math.max(minimum, value));
  }

  private applyBubbleStyle(
    target: TurboWarpTarget,
    type: string,
    text: unknown,
    selection: BubbleStyleSelection,
  ): void {
    const bubbleState = this.getBubbleState(target);
    if (!bubbleState || typeof bubbleState.skinId !== "number") return;

    const normalizedText = this.normalizeMessage(text);
    if (bubbleState.text !== normalizedText) {
      bubbleState.text = normalizedText;
      this.runtime.renderer?.updateTextSkin?.(
        bubbleState.skinId,
        type,
        normalizedText,
        bubbleState.onSpriteRight,
        [0, 0],
      );
    }

    const skin = this.getTextBubbleSkin(bubbleState.skinId);
    if (typeof skin?.setStyle === "function") {
      this.installAlignmentRenderer(skin);
      skin.setStyle(this.createRenderStyle(selection.definition));
    }
    this.installTargetPositionHook(target);
    target.onTargetVisualChange?.(target);
    this.runtime.requestRedraw?.();
  }

  private handleSayOrThink(
    target: TurboWarpTarget,
    type: string,
    text: unknown,
  ): void {
    const selection =
      this.pendingStyles.get(target) ?? this.resolveStyle(defaultStyleName);
    this.pendingStyles.delete(target);
    const normalizedText = this.normalizeMessage(
      this.getBubbleState(target)?.text ?? text,
    );
    if (normalizedText === "") {
      this.activeStyles.delete(target);
      return;
    }
    this.activeStyles.set(target, selection);
    this.applyBubbleStyle(target, type, normalizedText, selection);
  }

  private handleStageSizeChanged(): void {
    for (const target of this.runtime.targets ?? []) {
      const bubbleState = this.getBubbleState(target);
      if (!bubbleState?.text) continue;
      const selection =
        this.activeStyles.get(target) ?? this.resolveStyle(defaultStyleName);
      this.applyBubbleStyle(
        target,
        bubbleState.type,
        bubbleState.text,
        selection,
      );
    }

    for (const [target, state] of [...this.textActors]) {
      this.applyTextActor(
        target,
        state.text,
        this.resolveStyle(state.styleName),
      );
    }
  }

  private restyleVisibleBubbles(
    styleName: string,
    definition: BubbleStyleDefinition,
  ): void {
    for (const target of this.runtime.targets ?? []) {
      const selection = this.activeStyles.get(target);
      const bubbleState = this.getBubbleState(target);
      if (selection?.styleName !== styleName || !bubbleState?.text) continue;
      const nextSelection = { definition, styleName };
      this.activeStyles.set(target, nextSelection);
      this.applyBubbleStyle(
        target,
        bubbleState.type,
        bubbleState.text,
        nextSelection,
      );
    }
  }

  private restyleTextActors(styleName: string): void {
    const definition = this.styles.get(styleName);
    if (!definition) return;
    for (const [target, state] of [...this.textActors]) {
      if (state.styleName !== styleName) continue;
      this.applyTextActor(target, state.text, { definition, styleName });
    }
  }

  private showStyledBubble(
    type: "say" | "think",
    args: StyledBubbleArguments,
    util: BlockUtility,
  ): void {
    this.showBubble(type, args.MESSAGE, this.resolveStyle(args.STYLE), util);
  }

  private showLegacyBubble(
    type: "say" | "think",
    args: LegacyBubbleArguments,
    util: BlockUtility,
  ): void {
    const defaultDefinition =
      this.styles.get(defaultStyleName) ?? initialDefaultStyle;
    this.showBubble(
      type,
      args.MESSAGE,
      {
        definition: {
          ...defaultDefinition,
          fontPercent: this.normalizeFontPercent(args.SIZE),
        },
        styleName: null,
      },
      util,
    );
  }

  private showBubble(
    type: "say" | "think",
    messageValue: unknown,
    selection: BubbleStyleSelection,
    util: BlockUtility,
  ): void {
    const message = this.normalizeMessage(messageValue);
    this.pendingStyles.set(util.target, selection);
    try {
      this.runtime.emit("SAY", util.target, type, message);
    } finally {
      this.pendingStyles.delete(util.target);
    }
  }
}
