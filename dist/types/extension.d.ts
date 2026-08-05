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
interface SvgTextExtensionOptions {
    castToString?: (value: unknown) => string;
    listenForRuntimeEvents?: boolean;
}
export declare const EXTENSION_DOCS_URI = "https://kubohiroya.github.io/turbowarp-svg-text/";
export declare class SvgTextExtension implements TurboWarpExtension {
    private readonly runtime;
    private readonly castToString;
    private readonly styles;
    private readonly activeStyles;
    private readonly textActors;
    private readonly pendingStyles;
    private readonly alignedSkins;
    private readonly targetPositionHooks;
    constructor(runtime?: any, options?: SvgTextExtensionOptions);
    getInfo(): Record<string, unknown>;
    defineStyle(args: DefineStyleArguments): void;
    setText(args: TextActorArguments, util: BlockUtility): void;
    releaseTextActor(target: TurboWarpTarget): boolean;
    sayWithStyle(args: StyledBubbleArguments, util: BlockUtility): void;
    thinkWithStyle(args: StyledBubbleArguments, util: BlockUtility): void;
    say(args: LegacyBubbleArguments, util: BlockUtility): void;
    think(args: LegacyBubbleArguments, util: BlockUtility): void;
    private toScratchBlock;
    private normalizeStyleName;
    private normalizeFontPercent;
    private normalizeMessage;
    private normalizeAlignment;
    private normalizeDirection;
    private normalizeColor;
    private normalizeFont;
    private getStageScale;
    private createRenderStyle;
    private createTextActorSvg;
    private measureTextWidth;
    private escapeXml;
    private formatSvgNumber;
    private applyTextActor;
    private resolveStyle;
    private getBubbleState;
    private getTextBubbleSkin;
    private installAlignmentRenderer;
    private installTargetPositionHook;
    private positionBubble;
    private updateTextSkin;
    private clampPosition;
    private applyBubbleStyle;
    private handleSayOrThink;
    private handleStageSizeChanged;
    private restyleVisibleBubbles;
    private restyleTextActors;
    private showStyledBubble;
    private showLegacyBubble;
    private showBubble;
}
export {};
