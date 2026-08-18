import definitions from "./block-definitions.json";
import { extensionConfig } from "./config.js";
import {
  createSvgTextLayout,
  DEFAULT_SVG_TEXT_STYLE,
  normalizeSvgTextColor,
  normalizeSvgTextFont,
  renderSvgTextLayout,
  type SvgTextAlignment,
  type SvgTextNativeSize,
  type SvgTextStyleDefinition,
} from "./text-layout.js";

export type { SvgTextStyleDefinition } from "./text-layout.js";

type BlockTypeName = "COMMAND";
type ArgumentTypeName = "COLOR" | "NUMBER" | "STRING";

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

export const BLOCK_ICON_URI = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 23V12h11M40 12h11v11M13 41v11h11M40 52h11V41M22 23h20M32 23v23"/></g></svg>',
)}`;

export class SvgTextExtension implements TurboWarpExtension {
  private readonly runtime: TurboWarpRuntime;
  private readonly castToString: (value: unknown) => string;
  private readonly styles = new Map<string, Readonly<SvgTextStyleDefinition>>([
    [defaultStyleName, DEFAULT_SVG_TEXT_STYLE],
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
        DEFAULT_SVG_TEXT_STYLE.backgroundColor,
      ),
      font: this.normalizeFont(args.FONT),
      fontPercent: this.normalizeFontPercent(args.SIZE),
      textColor: this.normalizeColor(
        args.TEXT_COLOR,
        DEFAULT_SVG_TEXT_STYLE.textColor,
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
    const layout = createSvgTextLayout(
      normalizedText,
      selection.definition,
      this.getNativeSize(),
    );
    return Math.max(0, ...layout.lines.map((line) => line.width));
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

  private normalizeAlignment(value: unknown): SvgTextAlignment {
    const alignment = this.castToString(value).trim().toLowerCase();
    if (alignment === "center" || alignment === "right") return alignment;
    return "left";
  }

  private normalizeColor(value: unknown, fallback: string): string {
    return normalizeSvgTextColor(this.castToString(value), fallback);
  }

  private normalizeFont(value: unknown): string {
    return normalizeSvgTextFont(this.castToString(value));
  }

  private getNativeSize(): SvgTextNativeSize {
    const nativeSize = this.runtime.renderer?.getNativeSize?.();
    if (!Array.isArray(nativeSize) || nativeSize.length < 2) return [480, 360];
    const width = Number(nativeSize[0]);
    const height = Number(nativeSize[1]);
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

  private createTextActorSvg(
    text: string,
    definition: Readonly<SvgTextStyleDefinition>,
  ): string {
    return renderSvgTextLayout(
      createSvgTextLayout(text, definition, this.getNativeSize()),
    );
  }

  private applyTextActor(
    target: TurboWarpTarget,
    text: string,
    selection: {
      definition: Readonly<SvgTextStyleDefinition>;
      styleName: string;
    },
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
    definition: Readonly<SvgTextStyleDefinition>;
    styleName: string;
  } {
    const requestedName = this.normalizeStyleName(value);
    const definition = this.styles.get(requestedName);
    if (definition) return { definition, styleName: requestedName };
    return {
      definition: this.styles.get(defaultStyleName) ?? DEFAULT_SVG_TEXT_STYLE,
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
