import { type SvgTextAlignment, type SvgTextLayout, type SvgTextNativeSize } from "./text-layout.js";
export type { SvgTextAlignment, SvgTextLayout, SvgTextLayoutLine, SvgTextLayoutStyle, SvgTextNativeSize, } from "./text-layout.js";
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
export interface SvgTextLayoutInput {
    nativeSize: SvgTextNativeSize;
    styleName: string;
    text: string;
}
export interface SvgTextLayoutComposition {
    defineStyle(input: SvgTextStyleInput): void;
    layoutText(input: SvgTextLayoutInput): SvgTextLayout;
}
export interface SvgTextComposition extends SvgTextLayoutComposition {
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
export declare function createSvgTextLayoutComposition(): SvgTextLayoutComposition;
export declare function createSvgTextComposition(options: SvgTextCompositionOptions): SvgTextComposition;
