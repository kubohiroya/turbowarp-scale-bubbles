# TurboWarp SVG Text

TurboWarp SVG Text provides responsive text with reusable named styles. The same style can be shared by say/think bubbles and SVG skins that turn a sprite itself into a text actor. Text remains proportional to the stage when its dimensions change.

See the [English guide](https://kubohiroya.github.io/turbowarp-svg-text/) or [Japanese guide](https://kubohiroya.github.io/turbowarp-svg-text/ja/) for usage and examples. The extension palette also opens the English guide through TurboWarp's `docsURI` feature.

## Features

- Define background color, text color, font, relative font size, and left/center/right alignment under any style name.
- Choose one of eight bubble directions: up, down, left, right, and the four diagonals.
- Display say and think bubbles with a named style.
- Replace the current sprite's skin with multiline SVG text using `set this sprite text`.
- Apply the redefinable `default` style to standard say, think, and ask bubbles.
- Convert literal `\n`, `\r\n`, and `\r` sequences in displayed strings into line breaks.
- Immediately update visible bubbles and SVG text when a style is redefined or the stage size changes.
- Keep legacy size-based say/think opcodes hidden but executable for saved-project compatibility.

Animation is not included in version 0.1.0.

## Blocks

### `define text style [STYLE] background [BACKGROUND] text [TEXT_COLOR] font [FONT] size [SIZE] align [ALIGN] bubble direction [DIRECTION]`

Defines or replaces a named style. `ALIGN` accepts `left`, `center`, or `right`. `DIRECTION` accepts `up`, `up-right`, `right`, `down-right`, `down`, `down-left`, `left`, or `up-left`; direction applies only to bubbles.

Redefining a name immediately redraws visible bubbles and SVG text actors that use it. Styles are runtime state, so projects should normally define them immediately after the green flag. A blank or unknown style name falls back to `default`.

### `set this sprite text [TEXT] with style [STYLE]`

Creates an SVG skin and applies it to the current sprite's drawable, making the sprite itself a text actor. Background color, text color, font, size, and alignment come from the selected style. A string containing `\n` is rendered as multiple safely escaped SVG `<tspan>` elements.

### `say [MESSAGE] with style [STYLE]`

Displays a say bubble using the selected named style.

### `think [MESSAGE] with style [STYLE]`

Displays a think bubble using the selected named style.

## Responsive sizing

Size 100 is TurboWarp's default 14-pixel bubble font on a 480×360 stage. Bubbles and SVG text actors use the same formula:

```text
stageScale = min(stageWidth / 480, stageHeight / 360)
fontSize = 14 × stageScale × styleSize / 100
```

| Stage   | Style size | Font size |
| ------- | ---------: | --------: |
| 480×360 |        100 |      14px |
| 960×720 |        100 |      28px |
| 960×720 |        150 |      42px |

Style sizes are clamped to 1–1000. A blank or non-finite value uses 100.

## Usage

Load the following URL as a TurboWarp custom extension and allow it to run unsandboxed:

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-svg-text@0.1.0/dist/svg-text.js
```

```text
define text style [narration] background [#fff4cc] text [#332200] font [Noto Sans JP] size [125] align [center] bubble direction [up]
say [Once upon a time...\nIn a village by the sea...] with style [narration]
set this sprite text [Act One\nUrashima Taro] with style [narration]
```

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

The TypeScript source is built by `@kubohiroya/vite-plugin-turbowarp-extension` into a single `dist/svg-text.js` file. The build also generates `dist/extension-manifest.json` for saved-project API compatibility checks.

## Compatibility and limitations

The extension runs unsandboxed because it uses the TurboWarp VM and renderer. Bubble support feature-detects the `SAY` and `STAGE_SIZE_CHANGED` events, the `Scratch.looks` custom state, drawable positioning, and scratch-render's `TextBubbleSkin.setStyle()`. SVG text actors use `createSVGSkin`, `updateDrawableSkinId`, and `destroySkin`.

If compatible private drawing hooks are unavailable, center/right bubble alignment falls back to left alignment. If drawable positioning is unavailable, TurboWarp's standard bubble placement is retained. `setText` reports an explicit error when SVG skin APIs are unavailable. Standard Scratch Looks continues to handle bubble stopping, replacement, target tracking, the 330-character limit, and number formatting.

## License

MPL-2.0
