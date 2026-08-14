export type SvgTextAlignment = "center" | "left" | "right";
export interface SvgTextStyleInput {
    name: string;
    alignment?: SvgTextAlignment;
    backgroundColor?: string;
    font?: string;
    fontPercent?: number;
    textColor?: string;
}
export interface SvgTextTarget {
    drawableID: number;
}
export interface SvgTextActorInput {
    styleName: string;
    target: SvgTextTarget;
    text: string;
}
export interface SvgTextCompositionRenderer {
    createSVGSkin(svg: string): number;
    destroySkin(skinId: number): void;
    getNativeSize?(): unknown;
    updateDrawableSkinId(drawableId: number, skinId: number): void;
}
export interface SvgTextCompositionRuntime {
    renderer: SvgTextCompositionRenderer;
    requestRedraw?(): void;
}
export interface SvgTextComposition {
    defineStyle(input: SvgTextStyleInput): void;
    measureText(input: SvgTextMeasureInput): number;
    releaseAll(): void;
    releaseTarget(target: SvgTextTarget): void;
    setText(input: SvgTextActorInput): void;
}
export interface SvgTextMeasureInput {
    styleName: string;
    text: string;
}
export interface SvgTextCompositionOptions {
    runtime: SvgTextCompositionRuntime;
}
export declare function createSvgTextComposition(options: SvgTextCompositionOptions): SvgTextComposition;
