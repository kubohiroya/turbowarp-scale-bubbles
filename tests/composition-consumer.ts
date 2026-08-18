import {
  createSvgTextComposition,
  createSvgTextLayoutComposition,
  type SvgTextContentRun,
  type SvgTextComposition,
  type SvgTextCompositionRuntime,
  type SvgTextLayout,
  type SvgTextLayoutComposition,
  type SvgTextNativeSize,
  type SvgTextRichLayout,
} from "@kubohiroya/turbowarp-svg-text/composition";

declare const runtime: SvgTextCompositionRuntime;
declare const target: { drawableID: number };

const composition: SvgTextComposition = createSvgTextComposition({ runtime });
composition.defineStyle({
  name: "title",
  alignment: "center",
  backgroundColor: "#112233",
  font: "Noto Sans JP",
  fontPercent: 150,
  rubyFontPercent: 50,
  rubyGap: 1,
  textColor: "#ffffff",
});
const nativeSize: SvgTextNativeSize = [480, 360];
const rendererLayout: SvgTextLayout = composition.layoutText({
  styleName: "title",
  text: "The End",
  nativeSize,
});
composition.setText({ styleName: "title", target, text: "The End" });
composition.measureText({ styleName: "title", text: "The End" });
const runs: readonly SvgTextContentRun[] = [
  { type: "text", text: "海へ" },
  { type: "ruby", base: "出発", reading: "しゅっぱつ" },
];
const richLayout: SvgTextRichLayout = composition.layoutRichText({
  styleName: "title",
  runs,
  nativeSize,
  maxWidth: 240,
});
composition.setRichText({ styleName: "title", target, runs, maxWidth: 240 });
composition.measureRichText({ styleName: "title", runs, maxWidth: 240 });
composition.releaseTarget(target);
composition.releaseAll();

const layoutOnly: SvgTextLayoutComposition = createSvgTextLayoutComposition();
layoutOnly.defineStyle({ name: "overlay", backgroundColor: "transparent" });
const overlayLayout: SvgTextLayout = layoutOnly.layoutText({
  styleName: "overlay",
  text: "Safe DOM text",
  nativeSize,
});
const preserveWhitespace: true = overlayLayout.preserveWhitespace;
const overlayRichLayout: SvgTextRichLayout = layoutOnly.layoutRichText({
  styleName: "overlay",
  runs,
  nativeSize,
});
void rendererLayout;
void richLayout;
void overlayLayout;
void overlayRichLayout;
void preserveWhitespace;
