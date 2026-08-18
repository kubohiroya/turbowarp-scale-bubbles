# TurboWarp SVG Text

TurboWarp SVG Text provides responsive named styles and SVG text actors. It is a text provider for host extensions such as `turbowarp-bubble`; Bubble shape, placement, portraits, and animation belong to the host.

## Responsibilities

- Define reusable text styles for font, size, color, background, and alignment.
- Compute host-neutral line layout for DOM/SVG consumers without renderer APIs.
- Create, replace, measure, and release SVG text skins when a renderer is used.
- Keep text actors proportional to the stage.
- Restyle visible text actors when a named style changes.

This package does not provide `say` or `think` bubbles, bubble tails, actor-relative placement, portrait images, or bubble animation. Those responsibilities belong to the host package and its capabilities.

## Installation

Install the Composition API with an exact version:

```sh
pnpm add --save-exact @kubohiroya/turbowarp-svg-text@0.6.0
```

The standalone TurboWarp extension is available from the version-pinned jsDelivr URL:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-svg-text@0.6.0/dist/svg-text.js
```

## Blocks

### `define text style [STYLE] background [BACKGROUND] text [TEXT_COLOR] font [FONT] size [SIZE] align [ALIGN]`

Defines or replaces a named text style. Alignment accepts `left`, `center`, or `right`. The background is the rectangle behind an SVG text actor; a host Bubble can define a transparent background and render its own outer shape.

### `set this sprite text [TEXT] with style [STYLE]`

Creates an SVG skin and applies it to the current sprite's drawable. Newline characters render as separate lines. Reusing the same style name after redefinition redraws existing text actors.

## Composition API

The composition API does not register the standalone extension. The host supplies a TurboWarp runtime and explicit targets.

```ts
import { createSvgTextComposition } from "@kubohiroya/turbowarp-svg-text/composition";

const svgText = createSvgTextComposition({ runtime: Scratch.vm.runtime });

svgText.defineStyle({
  name: "dialogue-text",
  alignment: "left",
  backgroundColor: "transparent",
  font: "Noto Sans JP",
  fontPercent: 100,
  textColor: "#332200",
});

svgText.setText({
  styleName: "dialogue-text",
  target,
  text: "The End",
});

const width = svgText.measureText({
  styleName: "dialogue-text",
  text: "The End",
});

svgText.releaseTarget(target);
svgText.releaseAll();
```

`setText` creates or replaces the SVG skin owned by the composition. `measureText` returns the maximum measured line width in stage-relative pixels. `releaseTarget` and `releaseAll` destroy skins owned by the composition.

### Host-neutral text layout

`createSvgTextLayoutComposition()` needs no TurboWarp runtime, renderer, skin, or drawable. `layoutText()` is synchronous and accepts an explicit renderer-native stage size. It returns a deeply frozen, JSON-compatible data object containing overall `width`/`height`, the required whitespace policy, normalized allowed style values, and each line's text, measured width, horizontal `x`, and vertical `baseline`.

```ts
import { createSvgTextLayoutComposition } from "@kubohiroya/turbowarp-svg-text/composition";

const svgText = createSvgTextLayoutComposition();
svgText.defineStyle({
  name: "dialogue-text",
  alignment: "center",
  backgroundColor: "transparent",
  font: "Noto Sans JP",
  fontPercent: 100,
  textColor: "#332200",
});

const layout = svgText.layoutText({
  styleName: "dialogue-text",
  text: "First line\nSecond line",
  nativeSize: [480, 360],
});

const svgNamespace = "http://www.w3.org/2000/svg";
const xmlNamespace = "http://www.w3.org/XML/1998/namespace";
const textElement = document.createElementNS(svgNamespace, "text");
if (layout.preserveWhitespace) {
  textElement.setAttributeNS(xmlNamespace, "xml:space", "preserve");
}
textElement.setAttribute("fill", layout.style.textColor);
textElement.setAttribute("font-family", layout.style.font);
textElement.setAttribute("font-size", String(layout.style.fontSize));
textElement.setAttribute(
  "text-anchor",
  layout.style.alignment === "center"
    ? "middle"
    : layout.style.alignment === "right"
      ? "end"
      : "start",
);
for (const line of layout.lines) {
  const tspan = document.createElementNS(svgNamespace, "tspan");
  tspan.setAttribute("x", String(line.x));
  tspan.setAttribute("y", String(line.baseline));
  tspan.textContent = line.text;
  textElement.append(tspan);
}
```

The host must apply `preserveWhitespace` and assign line content through `textContent`, as above. The API accepts and returns no SVG markup, DOM nodes, event handlers, URLs, or `foreignObject`; arbitrary input text remains plain line data. `SvgTextComposition.layoutText()` exposes the same contract on a renderer-backed composition. Both paths share the same layout calculation, so whitespace, font, computed font size, alignment, line height, colors, padding, corner radius, line placement, width, and height match `setText()`.

`SvgTextComposition` is intentionally suitable for a host Capability adapter:

```ts
interface TextCapability {
  setText(input: {
    styleName: string;
    target: { drawableID: number };
    text: string;
  }): void;
  measureText(input: { styleName: string; text: string }): number;
  releaseTarget(target: { drawableID: number }): void;
}
```

## Integration with TurboWarp Bubble

`@kubohiroya/turbowarp-bubble` owns the Bubble outer shape, placement, portrait layers, and animation. It can use this package as its `BubbleTextCapability`, but the Bubble core does not depend on SVG Text itself.

The host-neutral contract is first available in `0.6.0`. [TurboWarp Bubble #59](https://github.com/kubohiroya/turbowarp-bubble/issues/59) should pin `0.6.0` for development and declare `@kubohiroya/turbowarp-svg-text` as `>=0.6.0 <0.7.0` when it consumes `layoutText()`. This additive minor does not change the renderer-backed or standalone extension behavior. While the package is `0.x`, breaking contract changes require a new minor version; patches may fix calculations without changing the returned shape. To roll back, pin `0.5.0` and select Bubble's existing `scratch-render` backend.

## Development

```sh
pnpm install
pnpm check
```

The version in `package.json` is the release source of truth. The consistency check keeps the exact-version README and Pages examples aligned and rejects a release tag that does not match it.

The package is distributed under MPL-2.0. See `LICENSE` for the source code terms.
