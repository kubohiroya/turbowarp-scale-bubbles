import {
  createSvgTextComposition,
  createSvgTextLayoutComposition,
  type SvgTextComposition,
  type SvgTextCompositionRuntime,
  type SvgTextLayout,
  type SvgTextLayoutComposition,
  type SvgTextNativeSize,
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
void rendererLayout;
void overlayLayout;
void preserveWhitespace;
