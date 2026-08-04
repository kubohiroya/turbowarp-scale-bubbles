interface TurboWarpExtension {
  getInfo(): Record<string, unknown>;
}

interface ScratchTranslate {
  (text: string): string;
  (
    message: { default: string; description?: string },
    placeholders?: Record<string, string | number>,
  ): string;
}

interface TextBubbleState {
  drawableId: number | null;
  skinId: number | null;
  text: string;
  type: string;
  onSpriteRight: boolean;
}

interface TextBubbleRenderStyle {
  bubbleFill?: string;
  font?: string;
  fontHeightRatio?: number;
  fontSize?: number;
  lineHeight?: number;
  padding?: number;
  textAlign?: string;
  textFill?: string;
  [property: string]: number | string | undefined;
}

interface TextBubbleSkin {
  _canvas?: HTMLCanvasElement;
  _lines?: string[];
  _renderTextBubble?(scale: number): void;
  _style?: TextBubbleRenderStyle;
  _textAreaSize?: { width: number; height: number };
  setStyle?(style: TextBubbleRenderStyle): void;
}

interface TurboWarpRenderer {
  _allSkins?:
    Map<number, TextBubbleSkin> | Record<number, TextBubbleSkin | undefined>;
  getNativeSize?(): unknown;
  getCurrentSkinSize?(drawableId: number): unknown;
  createSVGSkin?(svg: string): number;
  destroySkin?(skinId: number): void;
  updateDrawableSkinId?(drawableId: number, skinId: number): void;
  updateDrawablePosition?(drawableId: number, position: [number, number]): void;
  updateTextSkin?(
    skinId: number,
    type: string,
    text: string,
    onSpriteRight: boolean,
    bubbleScale: [number, number],
  ): void;
}

interface TurboWarpBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface TurboWarpTarget {
  drawableID?: number | null;
  getBoundsForBubble?(): TurboWarpBounds;
  getCustomState?(key: string): unknown;
  onTargetVisualChange?: ((target: TurboWarpTarget) => void) | null;
  visible?: boolean;
  x?: number;
  y?: number;
}

interface TurboWarpRuntime {
  renderer?: TurboWarpRenderer;
  targets?: TurboWarpTarget[];
  on(
    event: "SAY",
    listener: (target: TurboWarpTarget, type: string, text: unknown) => void,
  ): void;
  on(event: "STAGE_SIZE_CHANGED", listener: () => void): void;
  emit(event: string, ...args: unknown[]): void;
  requestRedraw?(): void;
}

interface ScratchApi {
  extensions: {
    unsandboxed: boolean;
    register(extension: TurboWarpExtension): void;
  };
  BlockType: Record<"COMMAND" | "REPORTER" | "BOOLEAN" | "HAT", string>;
  ArgumentType: Record<"STRING" | "NUMBER" | "BOOLEAN" | "COLOR", string>;
  Cast: {
    toString(value: unknown): string;
    toNumber(value: unknown): number;
    toBoolean(value: unknown): boolean;
  };
  translate: ScratchTranslate;
  vm?: {
    runtime?: TurboWarpRuntime;
  };
}

declare const Scratch: ScratchApi;
