export type SvgTextAlignment = "center" | "left" | "right";
export type SvgTextDirection = "up" | "up-up-right" | "up-right" | "right-up-right" | "right" | "right-down-right" | "down-right" | "down-down-right" | "down" | "down-down-left" | "down-left" | "left-down-left" | "left" | "left-up-left" | "up-left" | "up-up-left" | number;
export interface SvgTextStyleInput {
    name: string;
    alignment?: SvgTextAlignment;
    backgroundColor?: string;
    direction?: SvgTextDirection;
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
    releaseAll(): void;
    releaseTarget(target: SvgTextTarget): void;
    setText(input: SvgTextActorInput): void;
}
export interface SvgTextCompositionOptions {
    runtime: SvgTextCompositionRuntime;
}
export declare function createSvgTextComposition(options: SvgTextCompositionOptions): SvgTextComposition;
