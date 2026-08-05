delete globalThis.Scratch;

const compositionModule = await import("../dist/composition.js");
if (typeof compositionModule.createSvgTextComposition !== "function") {
  throw new Error(
    "The composition bundle does not export createSvgTextComposition.",
  );
}
