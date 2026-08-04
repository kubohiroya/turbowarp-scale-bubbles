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
  skinId: number | null;
  text: string;
  type: string;
  onSpriteRight: boolean;
}

interface TextBubbleSkin {
  setStyle?(style: Record<string, number>): void;
}

interface TurboWarpRenderer {
  _allSkins?:
    Map<number, TextBubbleSkin> | Record<number, TextBubbleSkin | undefined>;
  getNativeSize?(): unknown;
  updateTextSkin?(
    skinId: number,
    type: string,
    text: string,
    onSpriteRight: boolean,
    bubbleScale: [number, number],
  ): void;
}

interface TurboWarpTarget {
  getCustomState?(key: string): unknown;
  onTargetVisualChange?(target: TurboWarpTarget): void;
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
  ArgumentType: Record<"STRING" | "NUMBER" | "BOOLEAN", string>;
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
