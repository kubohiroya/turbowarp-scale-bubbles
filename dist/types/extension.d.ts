import { type SvgTextLayout, type SvgTextNativeSize, type SvgTextRichStyleDefinition } from "./text-layout.js";
export type { SvgTextRichStyleDefinition, SvgTextStyleDefinition, } from "./text-layout.js";
interface TextActorArguments {
    STYLE: unknown;
    TEXT: unknown;
}
interface DefineStyleArguments {
    ALIGN: unknown;
    BACKGROUND: unknown;
    FONT: unknown;
    RUBY_GAP?: unknown;
    RUBY_SIZE?: unknown;
    SIZE: unknown;
    STYLE: unknown;
    TEXT_COLOR: unknown;
}
interface BlockUtility {
    target: TurboWarpTarget;
}
interface CompositionTextActorContent {
    kind: "composition";
    render: (definition: Readonly<SvgTextRichStyleDefinition>, nativeSize: SvgTextNativeSize) => string;
}
interface SvgTextExtensionOptions {
    castToString?: (value: unknown) => string;
    listenForRuntimeEvents?: boolean;
}
export interface SvgTextLayoutCapability {
    layoutText(input: Readonly<{
        nativeSize: SvgTextNativeSize;
        styleName: string;
        text: string;
    }>): SvgTextLayout;
}
export declare const EXTENSION_DOCS_URI = "https://kubohiroya.github.io/turbowarp-svg-text/";
export declare const BLOCK_ICON_URI: string;
export declare class SvgTextExtension implements TurboWarpExtension {
    private readonly runtime;
    private readonly castToString;
    private readonly styles;
    private readonly textActors;
    private layoutCapabilityValue?;
    constructor(runtime?: any, options?: SvgTextExtensionOptions);
    getInfo(): Record<string, unknown>;
    defineStyle(args: DefineStyleArguments): void;
    setText(args: TextActorArguments, util: BlockUtility): void;
    measureText(styleName: unknown, text: unknown): number;
    /**
     * Exposes the stock named-style registry through a skin-free layout contract.
     * Consumers receive current layout data without access to the mutable registry.
     */
    getLayoutCapability(): SvgTextLayoutCapability;
    setCompositionText(styleName: unknown, render: CompositionTextActorContent["render"], target: TurboWarpTarget): void;
    releaseTextActor(target: TurboWarpTarget): boolean;
    private toScratchBlock;
    private normalizeStyleName;
    private normalizeFontPercent;
    private normalizeRubyFontPercent;
    private normalizeRubyGap;
    private normalizeMessage;
    private normalizeAlignment;
    private normalizeColor;
    private normalizeFont;
    private getNativeSize;
    private requireLayoutNativeSize;
    private createTextActorSvg;
    private applyTextActor;
    private resolveStyle;
    private restyleTextActors;
}
