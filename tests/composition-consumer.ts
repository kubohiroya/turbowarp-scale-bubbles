import {
  createSvgTextComposition,
  type SvgTextComposition,
  type SvgTextCompositionRuntime,
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
composition.setText({ styleName: "title", target, text: "The End" });
composition.measureText({ styleName: "title", text: "The End" });
composition.releaseTarget(target);
composition.releaseAll();
