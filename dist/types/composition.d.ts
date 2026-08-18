import { type SvgTextAlignment, type SvgTextContentRun, type SvgTextLayout, type SvgTextNativeSize, type SvgTextRichLayout } from "./text-layout.js";
export type { SvgTextAlignment, SvgTextContentRubyRun, SvgTextContentRun, SvgTextContentTextRun, SvgTextLayout, SvgTextLayoutLine, SvgTextLayoutStyle, SvgTextNativeSize, SvgTextRevealUnit, SvgTextRichLayout, SvgTextRichLayoutFragment, SvgTextRichLayoutGlyph, SvgTextRichLayoutLine, SvgTextRichLayoutRubyFragment, SvgTextRichLayoutStyle, SvgTextRichLayoutTextFragment, } from "./text-layout.js";
export interface SvgTextStyleInput {
    name: string;
    alignment?: SvgTextAlignment;
    backgroundColor?: string;
    font?: string;
    fontPercent?: number;
    rubyFontPercent?: number;
    rubyGap?: number;
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
export interface SvgTextRichLayoutInput {
    maxWidth?: number;
    nativeSize: SvgTextNativeSize;
    runs: readonly SvgTextContentRun[];
    styleName: string;
}
export interface SvgTextRichActorInput {
    maxWidth?: number;
    runs: readonly SvgTextContentRun[];
    styleName: string;
    target: SvgTextTarget;
}
export interface SvgTextRichMeasureInput {
    maxWidth?: number;
    runs: readonly SvgTextContentRun[];
    styleName: string;
}
export interface SvgTextLayoutComposition {
    defineStyle(input: SvgTextStyleInput): void;
    layoutRichText(input: SvgTextRichLayoutInput): SvgTextRichLayout;
    layoutText(input: SvgTextLayoutInput): SvgTextLayout;
}
export interface SvgTextComposition extends SvgTextLayoutComposition {
    measureRichText(input: SvgTextRichMeasureInput): number;
    measureText(input: SvgTextMeasureInput): number;
    releaseAll(): void;
    releaseTarget(target: SvgTextTarget): void;
    setRichText(input: SvgTextRichActorInput): void;
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
