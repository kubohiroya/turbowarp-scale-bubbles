export type SvgTextAlignment = "center" | "left" | "right";
export interface SvgTextStyleDefinition {
    alignment: SvgTextAlignment;
    backgroundColor: string;
    font: string;
    fontPercent: number;
    textColor: string;
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
export declare const DEFAULT_SVG_TEXT_STYLE: Readonly<SvgTextStyleDefinition>;
export declare function createSvgTextLayout(text: string, definition: Readonly<SvgTextStyleDefinition>, nativeSize: SvgTextNativeSize): SvgTextLayout;
export declare function renderSvgTextLayout(layout: SvgTextLayout): string;
export declare function normalizeSvgTextColor(value: string, fallback: string): string;
export declare function normalizeSvgTextFont(value: string): string;
