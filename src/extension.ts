import definitions from "./block-definitions.json";
import { extensionConfig } from "./config.js";

type BlockTypeName = "COMMAND";
type ArgumentTypeName = "NUMBER" | "STRING";

interface DefinitionArgument {
  type: ArgumentTypeName;
  defaultValue: number | string;
}

interface BlockDefinition {
  opcode: string;
  blockType: BlockTypeName;
  text: string;
  description: string;
  arguments: Record<string, DefinitionArgument>;
}

interface BubbleArguments {
  MESSAGE: unknown;
  SIZE: unknown;
}

interface BlockUtility {
  target: TurboWarpTarget;
}

const blockDefinitions = definitions.blocks as readonly BlockDefinition[];
const bubbleStateKey = "Scratch.looks";
const defaultFontPercent = 100;
const minimumFontPercent = 1;
const maximumFontPercent = 1000;
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
  lineHeight: 16,
} as const;

export class ScalableBubblesExtension implements TurboWarpExtension {
  private readonly runtime: TurboWarpRuntime;
  private readonly activeFontPercents = new WeakMap<TurboWarpTarget, number>();
  private readonly pendingFontPercents = new WeakMap<TurboWarpTarget, number>();

  public constructor(runtime = Scratch.vm?.runtime) {
    if (!runtime)
      throw new Error("Scalable Bubbles requires the TurboWarp VM.");
    this.runtime = runtime;
    this.handleSayOrThink = this.handleSayOrThink.bind(this);
    this.handleStageSizeChanged = this.handleStageSizeChanged.bind(this);
    this.runtime.on("SAY", this.handleSayOrThink);
    this.runtime.on("STAGE_SIZE_CHANGED", this.handleStageSizeChanged);
  }

  public getInfo(): Record<string, unknown> {
    return {
      id: extensionConfig.id,
      name: Scratch.translate(definitions.extensionName),
      color1: "#9966ff",
      blocks: blockDefinitions.map((block) => this.toScratchBlock(block)),
    };
  }

  public say(args: BubbleArguments, util: BlockUtility): void {
    this.showBubble("say", args, util);
  }

  public think(args: BubbleArguments, util: BlockUtility): void {
    this.showBubble("think", args, util);
  }

  private toScratchBlock(block: BlockDefinition): Record<string, unknown> {
    return {
      opcode: block.opcode,
      blockType: Scratch.BlockType[block.blockType],
      text: Scratch.translate(block.text),
      arguments: Object.fromEntries(
        Object.entries(block.arguments).map(([name, argument]) => [
          name,
          {
            type: Scratch.ArgumentType[argument.type],
            defaultValue: argument.defaultValue,
          },
        ]),
      ),
    };
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
    return Scratch.Cast.toString(value).replace(/\\r\\n|\\n|\\r/gu, "\n");
  }

  private getStageScale(): number {
    const nativeSize = this.runtime.renderer?.getNativeSize?.();
    if (!Array.isArray(nativeSize) || nativeSize.length < 2) return 1;
    const width = Number(nativeSize[0]);
    const height = Number(nativeSize[1]);
    if (!(width > 0) || !(height > 0)) return 1;
    return Math.min(width / baseStageWidth, height / baseStageHeight);
  }

  private createStyle(fontPercent: number): Record<string, number> {
    const stageScale = this.getStageScale();
    const fontScale = stageScale * (fontPercent / defaultFontPercent);
    return {
      maxLineWidth: baseStyle.maxLineWidth * stageScale,
      minWidth: baseStyle.minWidth * stageScale,
      strokeWidth: baseStyle.strokeWidth * stageScale,
      padding: baseStyle.padding * stageScale,
      cornerRadius: baseStyle.cornerRadius * stageScale,
      tailHeight: baseStyle.tailHeight * stageScale,
      fontSize: baseStyle.fontSize * fontScale,
      lineHeight: baseStyle.lineHeight * fontScale,
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

  private applyBubbleStyle(
    target: TurboWarpTarget,
    type: string,
    text: unknown,
    fontPercent: number,
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
    if (typeof skin?.setStyle !== "function") return;
    skin.setStyle(this.createStyle(fontPercent));
    target.onTargetVisualChange?.(target);
    this.runtime.requestRedraw?.();
  }

  private handleSayOrThink(
    target: TurboWarpTarget,
    type: string,
    text: unknown,
  ): void {
    const pendingFontPercent = this.pendingFontPercents.get(target);
    this.pendingFontPercents.delete(target);
    const fontPercent = pendingFontPercent ?? defaultFontPercent;
    const normalizedText = this.normalizeMessage(
      this.getBubbleState(target)?.text ?? text,
    );
    if (normalizedText === "") {
      this.activeFontPercents.delete(target);
      return;
    }
    this.activeFontPercents.set(target, fontPercent);
    this.applyBubbleStyle(target, type, normalizedText, fontPercent);
  }

  private handleStageSizeChanged(): void {
    for (const target of this.runtime.targets ?? []) {
      const bubbleState = this.getBubbleState(target);
      if (!bubbleState?.text) continue;
      this.applyBubbleStyle(
        target,
        bubbleState.type,
        bubbleState.text,
        this.activeFontPercents.get(target) ?? defaultFontPercent,
      );
    }
  }

  private showBubble(
    type: "say" | "think",
    args: BubbleArguments,
    util: BlockUtility,
  ): void {
    const fontPercent = this.normalizeFontPercent(args.SIZE);
    const message = this.normalizeMessage(args.MESSAGE);
    this.pendingFontPercents.set(util.target, fontPercent);
    try {
      this.runtime.emit("SAY", util.target, type, message);
    } finally {
      this.pendingFontPercents.delete(util.target);
    }
  }
}
