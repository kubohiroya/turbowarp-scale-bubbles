interface TurboWarpExtension {
  getInfo(): Record<string, unknown>;
}

interface TurboWarpRenderer {
  getNativeSize?(): unknown;
  createSVGSkin?(svg: string): number;
  destroySkin?(skinId: number): void;
  updateDrawableSkinId?(drawableId: number, skinId: number): void;
}

interface TurboWarpTarget {
  drawableID?: number | null;
}

interface TurboWarpRuntime {
  renderer?: TurboWarpRenderer;
  on(event: "STAGE_SIZE_CHANGED", listener: () => void): void;
  requestRedraw?(): void;
}

interface ScratchTranslate {
  (text: string): string;
  (
    message: { default: string; description?: string },
    placeholders?: Record<string, string | number>,
  ): string;
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
