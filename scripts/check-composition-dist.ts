export {};

delete (globalThis as { Scratch?: unknown }).Scratch;

const compositionUrl = new URL("../dist/composition.js", import.meta.url).href;
const compositionModule = (await import(compositionUrl)) as Record<
  string,
  unknown
>;
if (typeof compositionModule.createSvgTextComposition !== "function") {
  throw new Error(
    "The composition bundle does not export createSvgTextComposition.",
  );
}
if (typeof compositionModule.createSvgTextLayoutComposition !== "function") {
  throw new Error(
    "The composition bundle does not export createSvgTextLayoutComposition.",
  );
}
const layoutComposition = compositionModule.createSvgTextLayoutComposition();
if (typeof layoutComposition.layoutRichText !== "function") {
  throw new Error("The composition bundle does not expose layoutRichText.");
}
const rubyLayout = layoutComposition.layoutRichText({
  styleName: "default",
  runs: [
    { type: "text", text: "海へ" },
    { type: "ruby", base: "出発", reading: "しゅっぱつ" },
  ],
  nativeSize: [480, 360],
});
if (
  rubyLayout.plainText !== "海へ出発" ||
  rubyLayout.readingText !== "海へしゅっぱつ"
) {
  throw new Error("The composition bundle ruby contract is invalid.");
}
