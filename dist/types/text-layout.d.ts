export type SvgTextAlignment = "center" | "left" | "right";
export interface SvgTextStyleDefinition {
    alignment: SvgTextAlignment;
    backgroundColor: string;
    font: string;
    fontPercent: number;
    textColor: string;
}
export interface SvgTextRichStyleDefinition extends SvgTextStyleDefinition {
    rubyFontPercent: number;
    rubyGap: number;
}
export type SvgTextNativeSize = readonly [width: number, height: number];
export interface SvgTextLayoutStyle {
    readonly alignment: SvgTextAlignment;
    readonly backgroundColor: string;
    readonly cornerRadius: number;
    readonly font: string;
    readonly fontPercent: number;
    readonly fontSize: number;
    readonly lineHeight: number;
    readonly padding: number;
    readonly textColor: string;
}
export interface SvgTextLayoutLine {
    readonly baseline: number;
    readonly text: string;
    readonly width: number;
    readonly x: number;
}
export interface SvgTextLayout {
    readonly height: number;
    readonly lines: readonly SvgTextLayoutLine[];
    readonly preserveWhitespace: true;
    readonly style: SvgTextLayoutStyle;
    readonly width: number;
}
export interface SvgTextContentTextRun {
    readonly text: string;
    readonly type: "text";
}
export interface SvgTextContentRubyRun {
    readonly base: string;
    readonly reading: string;
    readonly type: "ruby";
}
export type SvgTextContentRun = SvgTextContentRubyRun | SvgTextContentTextRun;
export interface SvgTextRichLayoutStyle extends SvgTextLayoutStyle {
    readonly rubyFontPercent: number;
    readonly rubyFontSize: number;
    readonly rubyGap: number;
}
export interface SvgTextRevealUnit {
    readonly end: number;
    readonly index: number;
    readonly runIndex: number;
    readonly start: number;
    readonly type: "ruby" | "text";
}
export interface SvgTextRichLayoutGlyph {
    readonly baseline: number;
    readonly fontSize: number;
    readonly text: string;
    readonly width: number;
    readonly x: number;
}
export interface SvgTextRichLayoutTextFragment {
    readonly baseline: number;
    readonly revealIndex: number;
    readonly text: string;
    readonly type: "text";
    readonly width: number;
    readonly x: number;
}
export interface SvgTextRichLayoutRubyFragment {
    readonly base: SvgTextRichLayoutGlyph;
    readonly reading: SvgTextRichLayoutGlyph;
    readonly revealIndex: number;
    readonly type: "ruby";
    readonly width: number;
    readonly x: number;
}
export type SvgTextRichLayoutFragment = SvgTextRichLayoutRubyFragment | SvgTextRichLayoutTextFragment;
export interface SvgTextRichLayoutLine {
    readonly ascent: number;
    readonly baseline: number;
    readonly descent: number;
    readonly fragments: readonly SvgTextRichLayoutFragment[];
    readonly height: number;
    readonly overflow: boolean;
    readonly width: number;
    readonly x: number;
}
export interface SvgTextRichLayout {
    readonly height: number;
    readonly lines: readonly SvgTextRichLayoutLine[];
    readonly overflow: boolean;
    readonly plainText: string;
    readonly preserveWhitespace: true;
    readonly readingText: string;
    readonly revealUnits: readonly SvgTextRevealUnit[];
    readonly style: SvgTextRichLayoutStyle;
    readonly width: number;
}
export declare const DEFAULT_SVG_TEXT_STYLE: Readonly<SvgTextStyleDefinition>;
export declare const DEFAULT_SVG_TEXT_RICH_STYLE: Readonly<SvgTextRichStyleDefinition>;
export declare function createSvgTextLayout(text: string, definition: Readonly<SvgTextStyleDefinition>, nativeSize: SvgTextNativeSize): SvgTextLayout;
export declare function createSvgTextRichLayout(runs: readonly SvgTextContentRun[], definition: Readonly<SvgTextRichStyleDefinition>, nativeSize: SvgTextNativeSize, maxWidth?: number): SvgTextRichLayout;
export declare function renderSvgTextLayout(layout: SvgTextLayout): string;
export declare function renderSvgTextRichLayout(layout: SvgTextRichLayout): string;
export declare function normalizeSvgTextColor(value: string, fallback: string): string;
export declare function normalizeSvgTextFont(value: string): string;
