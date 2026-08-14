import definitions from "./block-definitions.json";
import { extensionConfig } from "./config.js";

type BlockTypeName = "COMMAND";
type ArgumentTypeName = "COLOR" | "NUMBER" | "STRING";
type TextAlignment = "center" | "left" | "right";

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

interface TextActorArguments {
  STYLE: unknown;
  TEXT: unknown;
}

interface DefineStyleArguments {
  ALIGN: unknown;
  BACKGROUND: unknown;
  FONT: unknown;
  SIZE: unknown;
  STYLE: unknown;
  TEXT_COLOR: unknown;
}

interface BlockUtility {
  target: TurboWarpTarget;
}

export interface SvgTextStyleDefinition {
  alignment: TextAlignment;
  backgroundColor: string;
  font: string;
  fontPercent: number;
  textColor: string;
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
const defaultStyleName = "default";
const defaultFontPercent = 100;
const minimumFontPercent = 1;
const maximumFontPercent = 1000;
const maximumFontNameLength = 128;
const baseStageWidth = 480;
const baseStageHeight = 360;
const textStyle = {
  fontSize: 14,
  lineHeight: 16,
  padding: 12,
  cornerRadius: 8,
} as const;

const initialDefaultStyle: SvgTextStyleDefinition = {
  alignment: "left",
  backgroundColor: "#ffffff",
  font: "Helvetica",
  fontPercent: defaultFontPercent,
  textColor: "#575e75",
};

export const BLOCK_ICON_URI = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 23V12h11M40 12h11v11M13 41v11h11M40 52h11V41M22 23h20M32 23v23"/></g></svg>',
)}`;

export class SvgTextExtension implements TurboWarpExtension {
  private readonly runtime: TurboWarpRuntime;
  private readonly castToString: (value: unknown) => string;
  private readonly styles = new Map<string, SvgTextStyleDefinition>([
    [defaultStyleName, initialDefaultStyle],
  ]);
  private readonly textActors = new Map<TurboWarpTarget, TextActorState>();

  public constructor(
    runtime = Scratch.vm?.runtime,
    options: SvgTextExtensionOptions = {},
  ) {
    if (!runtime) throw new Error("SVG Text requires the TurboWarp VM.");
    this.runtime = runtime;
    this.castToString = options.castToString ?? Scratch.Cast.toString;
    if (options.listenForRuntimeEvents ?? true) {
      this.runtime.on("STAGE_SIZE_CHANGED", () => {
        this.restyleTextActors();
      });
    }
  }

  public getInfo(): Record<string, unknown> {
    return {
      id: extensionConfig.id,
      name: Scratch.translate(definitions.extensionName),
      docsURI: EXTENSION_DOCS_URI,
      blockIconURI: BLOCK_ICON_URI,
      color1: "#9966ff",
      blocks: blockDefinitions.map((block) => this.toScratchBlock(block)),
      menus: definitionMenus,
    };
  }

  public defineStyle(args: DefineStyleArguments): void {
    const styleName = this.normalizeStyleName(args.STYLE);
    this.styles.set(styleName, {
      alignment: this.normalizeAlignment(args.ALIGN),
      backgroundColor: this.normalizeColor(
        args.BACKGROUND,
        initialDefaultStyle.backgroundColor,
      ),
      font: this.normalizeFont(args.FONT),
      fontPercent: this.normalizeFontPercent(args.SIZE),
      textColor: this.normalizeColor(
        args.TEXT_COLOR,
        initialDefaultStyle.textColor,
      ),
    });
    this.restyleTextActors(styleName);
  }

  public setText(args: TextActorArguments, util: BlockUtility): void {
    this.applyTextActor(
      util.target,
      this.normalizeMessage(args.TEXT),
      this.resolveStyle(args.STYLE),
    );
  }

  public measureText(styleName: unknown, text: unknown): number {
    const selection = this.resolveStyle(styleName);
    const normalizedText = this.normalizeMessage(text);
    const stageScale = this.getStageScale();
    const fontSize =
      textStyle.fontSize *
      stageScale *
      (selection.definition.fontPercent / defaultFontPercent);
    return Math.max(
      0,
      ...normalizedText
        .split("\n")
        .map((line) => this.measureTextWidth(line, fontSize)),
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

  private normalizeColor(value: unknown, fallback: string): string {
    const color = this.castToString(value).trim();
    if (color === "") return fallback;
    if (color.toLowerCase() === "transparent") return color;
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

  private createTextActorSvg(
    text: string,
    definition: SvgTextStyleDefinition,
  ): string {
    const stageScale = this.getStageScale();
    const fontScale =
      stageScale * (definition.fontPercent / defaultFontPercent);
    const fontSize = textStyle.fontSize * fontScale;
    const lineHeight = textStyle.lineHeight * fontScale;
    const padding = textStyle.padding * stageScale;
    const cornerRadius = textStyle.cornerRadius * stageScale;
    const lines = text.split("\n");
    const contentWidth = Math.max(
      1,
      ...lines.map((line) => this.measureTextWidth(line, fontSize)),
    );
    const width = Math.max(1, Math.ceil(contentWidth + padding * 2));
    const height = Math.max(
      1,
      Math.ceil(lineHeight * lines.length + padding * 2),
    );
    const textAnchor =
      definition.alignment === "center"
        ? "middle"
        : definition.alignment === "right"
          ? "end"
          : "start";
    const x =
      definition.alignment === "center"
        ? width / 2
        : definition.alignment === "right"
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
    selection: { definition: SvgTextStyleDefinition; styleName: string },
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
      styleName: selection.styleName,
      text,
    });
    if (previous && previous.skinId !== skinId) {
      renderer.destroySkin?.(previous.skinId);
    }
    this.runtime.requestRedraw?.();
  }

  private resolveStyle(value: unknown): {
    definition: SvgTextStyleDefinition;
    styleName: string;
  } {
    const requestedName = this.normalizeStyleName(value);
    const definition = this.styles.get(requestedName);
    if (definition) return { definition, styleName: requestedName };
    return {
      definition: this.styles.get(defaultStyleName) ?? initialDefaultStyle,
      styleName: defaultStyleName,
    };
  }

  private restyleTextActors(styleName?: string): void {
    for (const [target, state] of [...this.textActors]) {
      if (styleName !== undefined && state.styleName !== styleName) continue;
      this.applyTextActor(
        target,
        state.text,
        this.resolveStyle(state.styleName),
      );
    }
  }
}
