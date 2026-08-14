# TurboWarp SVG Text

TurboWarp SVG Text provides responsive named styles and SVG text actors. It is a text provider for host extensions such as `turbowarp-bubble`; Bubble shape, placement, portraits, and animation belong to the host.

## Responsibilities

- Define reusable text styles for font, size, color, background, and alignment.
- Create, replace, measure, and release SVG text skins.
- Keep text actors proportional to the stage.
- Restyle visible text actors when a named style changes.

This package does not provide `say` or `think` bubbles, bubble tails, actor-relative placement, portrait images, or bubble animation. Those responsibilities belong to the host package and its capabilities.

## Installation

Install the Composition API with an exact version:

```sh
pnpm add --save-exact @kubohiroya/turbowarp-svg-text@0.4.1
```

The standalone TurboWarp extension is available from the version-pinned jsDelivr URL:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-svg-text@0.4.1/dist/svg-text.js
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

## Development

```sh
pnpm install
pnpm check
```

The version in `package.json` is the release source of truth. The consistency check keeps the exact-version README and Pages examples aligned and rejects a release tag that does not match it.

The package is distributed under MPL-2.0. See `LICENSE` for the source code terms.
