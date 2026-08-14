type TextAlignment = "center" | "left" | "right";
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
interface SvgTextExtensionOptions {
    castToString?: (value: unknown) => string;
    listenForRuntimeEvents?: boolean;
}
export declare const EXTENSION_DOCS_URI = "https://kubohiroya.github.io/turbowarp-svg-text/";
export declare class SvgTextExtension implements TurboWarpExtension {
    private readonly runtime;
    private readonly castToString;
    private readonly styles;
    private readonly textActors;
    constructor(runtime?: any, options?: SvgTextExtensionOptions);
    getInfo(): Record<string, unknown>;
    defineStyle(args: DefineStyleArguments): void;
    setText(args: TextActorArguments, util: BlockUtility): void;
    measureText(styleName: unknown, text: unknown): number;
    releaseTextActor(target: TurboWarpTarget): boolean;
    private toScratchBlock;
    private normalizeStyleName;
    private normalizeFontPercent;
    private normalizeMessage;
    private normalizeAlignment;
    private normalizeColor;
    private normalizeFont;
    private getStageScale;
    private createTextActorSvg;
    private measureTextWidth;
    private escapeXml;
    private formatSvgNumber;
    private applyTextActor;
    private resolveStyle;
    private restyleTextActors;
}
export {};
