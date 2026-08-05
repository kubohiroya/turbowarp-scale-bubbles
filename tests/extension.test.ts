import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXTENSION_DOCS_URI, SvgTextExtension } from "../src/extension.js";

interface TestRuntime extends TurboWarpRuntime {
  renderer: TurboWarpRenderer;
  targets: TurboWarpTarget[];
}

interface FillTextCall {
  text: string;
  x: number;
  y: number;
}

interface LoadedExtension {
  createdSvgSkins: string[];
  destroyedSkinIds: number[];
  bubbleState: TextBubbleState;
  extension: SvgTextExtension;
  fillTextCalls: FillTextCall[];
  getRedrawCount(): number;
  getRepositionCount(): number;
  originalTextFills: Array<string | undefined>;
  positions: Array<[number, number]>;
  runtime: TestRuntime;
  setNativeSize(width: number, height: number): void;
  setTargetBounds(bounds: TurboWarpBounds): void;
  skin: TextBubbleSkin;
  styleUpdates: TextBubbleRenderStyle[];
  target: TurboWarpTarget;
  textUpdates: unknown[][];
  updatedDrawableSkins: Array<[number, number]>;
}

beforeEach(() => {
  vi.stubGlobal("Scratch", {
    ArgumentType: {
      BOOLEAN: "boolean",
      COLOR: "color",
      NUMBER: "number",
      STRING: "string",
    },
    BlockType: {
      BOOLEAN: "boolean",
      COMMAND: "command",
      HAT: "hat",
      REPORTER: "reporter",
    },
    Cast: {
      toBoolean: (value: unknown) => Boolean(value),
      toNumber: (value: unknown) => Number(value),
      toString: (value: unknown) => String(value),
    },
    extensions: {
      register: vi.fn(),
      unsandboxed: true,
    },
    translate: (value: string | { default: string }) =>
      typeof value === "string" ? value : value.default,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function loadExtension({
  bubbleSize = [100, 60],
  supportsAlignmentRenderer = false,
  supportsStyle = true,
}: {
  bubbleSize?: [number, number];
  supportsAlignmentRenderer?: boolean;
  supportsStyle?: boolean;
} = {}): LoadedExtension {
  const events = new EventEmitter();
  const bubbleState: TextBubbleState = {
    drawableId: 2,
    onSpriteRight: true,
    skinId: 1,
    text: "",
    type: "say",
  };
  const styleUpdates: TextBubbleRenderStyle[] = [];
  const textUpdates: unknown[][] = [];
  const fillTextCalls: FillTextCall[] = [];
  const originalTextFills: Array<string | undefined> = [];
  const positions: Array<[number, number]> = [];
  const createdSvgSkins: string[] = [];
  const destroyedSkinIds: number[] = [];
  const updatedDrawableSkins: Array<[number, number]> = [];
  let nextSvgSkinId = 100;
  const context = {
    fillStyle: "",
    fillText: (text: string, x: number, y: number) => {
      fillTextCalls.push({ text, x, y });
    },
    restore: vi.fn(),
    save: vi.fn(),
    textAlign: "start",
  } as unknown as CanvasRenderingContext2D;
  const skin: TextBubbleSkin = {};
  if (supportsStyle) {
    skin.setStyle = function setStyle(style) {
      styleUpdates.push(style);
      this._style = { ...this._style, ...style };
    };
  }
  if (supportsAlignmentRenderer) {
    skin._canvas = {
      getContext: () => context,
    } as unknown as HTMLCanvasElement;
    skin._lines = ["First", "Second"];
    skin._renderTextBubble = function renderOriginal() {
      originalTextFills.push(this._style?.textFill);
    };
    skin._style = {
      fontHeightRatio: 0.9,
      fontSize: 14,
      lineHeight: 16,
      padding: 10,
      textFill: "#575e75",
    };
    skin._textAreaSize = { height: 52, width: 100 };
  }
  let nativeSize = [480, 360];
  let targetBounds: TurboWarpBounds = {
    bottom: -20,
    left: -10,
    right: 10,
    top: 20,
  };
  let repositionCount = 0;
  let redrawCount = 0;
  const renderer: TurboWarpRenderer = {
    _allSkins: { 1: skin },
    createSVGSkin: (svg) => {
      createdSvgSkins.push(svg);
      return nextSvgSkinId++;
    },
    destroySkin: (skinId) => destroyedSkinIds.push(skinId),
    getCurrentSkinSize: () => bubbleSize,
    getNativeSize: () => nativeSize,
    updateDrawablePosition: (_drawableId, position) => positions.push(position),
    updateDrawableSkinId: (drawableId, skinId) =>
      updatedDrawableSkins.push([drawableId, skinId]),
    updateTextSkin: (...args) => textUpdates.push(args),
  };
  const target: TurboWarpTarget = {
    drawableID: 7,
    getBoundsForBubble: () => targetBounds,
    getCustomState: (key) => (key === "Scratch.looks" ? bubbleState : null),
    onTargetVisualChange: (changedTarget) => {
      expect(changedTarget).toBe(target);
      repositionCount += 1;
    },
  };
  const runtime = Object.assign(events, {
    renderer,
    targets: [target],
    requestRedraw: () => {
      redrawCount += 1;
    },
  }) as unknown as TestRuntime;

  // Scratch Looks registers this listener before third-party extensions load.
  runtime.on("SAY", (_target, type, text) => {
    bubbleState.type = type;
    bubbleState.text = String(text).slice(0, 330);
  });

  const extension = new SvgTextExtension(runtime);
  return {
    bubbleState,
    createdSvgSkins,
    destroyedSkinIds,
    extension,
    fillTextCalls,
    getRedrawCount: () => redrawCount,
    getRepositionCount: () => repositionCount,
    originalTextFills,
    positions,
    runtime,
    setNativeSize: (width, height) => {
      nativeSize = [width, height];
    },
    setTargetBounds: (bounds) => {
      targetBounds = bounds;
    },
    skin,
    styleUpdates,
    target,
    textUpdates,
    updatedDrawableSkins,
  };
}

function last<T>(values: T[]): T | undefined {
  return values[values.length - 1];
}

function directionFromBubblePosition(
  position: [number, number],
  bubbleSize: readonly [number, number],
): number {
  const bubbleCenterX = position[0] + bubbleSize[0] / 2;
  const bubbleCenterY = position[1] - bubbleSize[1] / 2;
  const degrees = (Math.atan2(bubbleCenterX, bubbleCenterY) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

const intermediateDirectionOffset = Math.SQRT2 - 1;
const canonicalDirectionPositions = new Map<string, [number, number]>([
  ["up", [-50, 92]],
  ["up-up-right", [-50 + 72 * intermediateDirectionOffset, 92]],
  ["up-right", [22, 92]],
  ["right-up-right", [22, 30 + 62 * intermediateDirectionOffset]],
  ["right", [22, 30]],
  ["right-down-right", [22, 30 - 62 * intermediateDirectionOffset]],
  ["down-right", [22, -32]],
  ["down-down-right", [-50 + 72 * intermediateDirectionOffset, -32]],
  ["down", [-50, -32]],
  ["down-down-left", [-50 - 72 * intermediateDirectionOffset, -32]],
  ["down-left", [-122, -32]],
  ["left-down-left", [-122, 30 - 62 * intermediateDirectionOffset]],
  ["left", [-122, 30]],
  ["left-up-left", [-122, 30 + 62 * intermediateDirectionOffset]],
  ["up-left", [-122, 92]],
  ["up-up-left", [-50 - 72 * intermediateDirectionOffset, 92]],
]);

const compassDirectionAliases: Array<[string, string]> = [
  ["north", "up"],
  ["north-northeast", "up-up-right"],
  ["northeast", "up-right"],
  ["east-northeast", "right-up-right"],
  ["east", "right"],
  ["east-southeast", "right-down-right"],
  ["southeast", "down-right"],
  ["south-southeast", "down-down-right"],
  ["south", "down"],
  ["south-southwest", "down-down-left"],
  ["southwest", "down-left"],
  ["west-southwest", "left-down-left"],
  ["west", "left"],
  ["west-northwest", "left-up-left"],
  ["northwest", "up-left"],
  ["north-northwest", "up-up-left"],
];

describe("SvgTextExtension", () => {
  it("registers named-style blocks and hides legacy size-based blocks", () => {
    const { extension } = loadExtension();
    const info = extension.getInfo() as {
      id: string;
      name: string;
      docsURI: string;
      blocks: Array<{
        opcode: string;
        hideFromPalette: boolean;
        arguments: Record<
          string,
          { defaultValue: number | string; menu?: string }
        >;
      }>;
      menus: Record<string, { acceptReporters: boolean; items: string[] }>;
    };

    expect(info.id).toBe("kubohiroyasvgtext");
    expect(info.name).toBe("SVG Text");
    expect(info.docsURI).toBe(EXTENSION_DOCS_URI);
    expect(EXTENSION_DOCS_URI).toBe(
      "https://kubohiroya.github.io/turbowarp-svg-text/",
    );
    expect(info.blocks.map((block) => block.opcode)).toEqual([
      "defineStyle",
      "setText",
      "sayWithStyle",
      "thinkWithStyle",
      "say",
      "think",
    ]);
    expect(
      info.blocks
        .filter((block) => block.hideFromPalette)
        .map((block) => block.opcode),
    ).toEqual(["say", "think"]);
    expect(info.blocks[0]?.arguments.ALIGN?.menu).toBe("alignment");
    expect(info.blocks[0]?.arguments.DIRECTION?.menu).toBe("direction");
    expect(info.menus.alignment).toEqual({
      acceptReporters: true,
      items: ["left", "center", "right"],
    });
    expect(info.menus.direction).toEqual({
      acceptReporters: true,
      items: [
        "up",
        "up-up-right",
        "up-right",
        "right-up-right",
        "right",
        "right-down-right",
        "down-right",
        "down-down-right",
        "down",
        "down-down-left",
        "down-left",
        "left-down-left",
        "left",
        "left-up-left",
        "up-left",
        "up-up-left",
      ],
    });
  });

  it("keeps standard say, think, and ask bubbles proportional with the default style", () => {
    const { bubbleState, runtime, setNativeSize, styleUpdates, target } =
      loadExtension();

    runtime.emit("SAY", target, "say", "Hello");
    expect(last(styleUpdates)).toMatchObject({
      bubbleFill: "#ffffff",
      font: "Helvetica",
      fontSize: 14,
      lineHeight: 16,
      maxLineWidth: 170,
      textAlign: "left",
      textFill: "#575e75",
    });

    setNativeSize(960, 720);
    runtime.emit("SAY", target, "think", "Thinking");
    expect(last(styleUpdates)).toMatchObject({
      fontSize: 28,
      lineHeight: 32,
      maxLineWidth: 340,
    });

    runtime.emit("SAY", target, "say", "Question?");
    expect(last(styleUpdates)?.fontSize).toBe(28);

    runtime.emit("SAY", target, "say", "x".repeat(400));
    expect(bubbleState.text).toHaveLength(330);
  });

  it("defines named colors, fonts, sizes, and alignment for say and think", () => {
    const { bubbleState, extension, styleUpdates, target } = loadExtension();
    extension.defineStyle({
      ALIGN: "center",
      BACKGROUND: "#123456",
      DIRECTION: "up-right",
      FONT: "Noto Sans JP",
      SIZE: 150,
      STYLE: "narration",
      TEXT_COLOR: "#fedcba",
    });

    extension.sayWithStyle(
      { MESSAGE: "Line 1\\nLine 2", STYLE: "narration" },
      { target },
    );
    expect(bubbleState.text).toBe("Line 1\nLine 2");
    expect(last(styleUpdates)).toMatchObject({
      bubbleFill: "#123456",
      font: "Noto Sans JP",
      fontSize: 21,
      lineHeight: 24,
      textAlign: "center",
      textFill: "#fedcba",
    });

    extension.thinkWithStyle(
      { MESSAGE: "Thinking", STYLE: "narration" },
      { target },
    );
    expect(bubbleState.type).toBe("think");
  });

  it("uses the same named style for a responsive multiline SVG text actor", () => {
    const {
      createdSvgSkins,
      destroyedSkinIds,
      extension,
      runtime,
      setNativeSize,
      target,
      updatedDrawableSkins,
    } = loadExtension();
    extension.defineStyle({
      ALIGN: "center",
      BACKGROUND: "#123456",
      DIRECTION: "down-left",
      FONT: "Noto Sans JP",
      SIZE: 150,
      STYLE: "title",
      TEXT_COLOR: "#fedcba",
    });

    extension.setText({ STYLE: "title", TEXT: "A<&\\n日本語" }, { target });
    expect(updatedDrawableSkins).toEqual([[7, 100]]);
    expect(createdSvgSkins[0]).toContain('fill="#123456"');
    expect(createdSvgSkins[0]).toContain('fill="#fedcba"');
    expect(createdSvgSkins[0]).toContain('font-family="Noto Sans JP"');
    expect(createdSvgSkins[0]).toContain('font-size="21"');
    expect(createdSvgSkins[0]).toContain('text-anchor="middle"');
    expect(createdSvgSkins[0]).toContain("A&lt;&amp;");
    expect(createdSvgSkins[0]?.match(/<tspan /gu)).toHaveLength(2);

    extension.defineStyle({
      ALIGN: "right",
      BACKGROUND: "#ffffff",
      DIRECTION: "up",
      FONT: "Helvetica",
      SIZE: 200,
      STYLE: "title",
      TEXT_COLOR: "#000000",
    });
    expect(last(updatedDrawableSkins)).toEqual([7, 101]);
    expect(destroyedSkinIds).toEqual([100]);
    expect(last(createdSvgSkins)).toContain('text-anchor="end"');

    setNativeSize(960, 720);
    runtime.emit("STAGE_SIZE_CHANGED", 960, 720);
    expect(last(updatedDrawableSkins)).toEqual([7, 102]);
    expect(destroyedSkinIds).toEqual([100, 101]);
    expect(last(createdSvgSkins)).toContain('font-size="56"');
  });

  it("reports unsupported renderers when setting a text actor", () => {
    const { extension, runtime, target } = loadExtension();
    delete runtime.renderer.createSVGSkin;

    expect(() =>
      extension.setText({ STYLE: "default", TEXT: "No SVG" }, { target }),
    ).toThrow("SVG Text requires SVG skin APIs from TurboWarp.");
  });

  it("positions bubbles in all sixteen style directions", () => {
    const { bubbleState, extension, positions, target } = loadExtension();

    for (const [direction, expectedPosition] of canonicalDirectionPositions) {
      extension.defineStyle({
        ALIGN: "left",
        BACKGROUND: "#ffffff",
        DIRECTION: direction,
        FONT: "Helvetica",
        SIZE: 100,
        STYLE: direction,
        TEXT_COLOR: "#575e75",
      });
      extension.sayWithStyle(
        { MESSAGE: direction, STYLE: direction },
        { target },
      );
      expect(last(positions)?.[0]).toBeCloseTo(expectedPosition[0]);
      expect(last(positions)?.[1]).toBeCloseTo(expectedPosition[1]);
    }

    expect(bubbleState.onSpriteRight).toBe(false);
  });

  it("normalizes all eight-way and sixteen-way compass aliases", () => {
    const { extension, positions, target } = loadExtension();

    for (const [alias, canonicalDirection] of compassDirectionAliases) {
      const direction =
        alias === "north-northwest" ? " North-Northwest " : alias;
      extension.defineStyle({
        ALIGN: "left",
        BACKGROUND: "#ffffff",
        DIRECTION: direction,
        FONT: "Helvetica",
        SIZE: 100,
        STYLE: alias,
        TEXT_COLOR: "#575e75",
      });
      extension.sayWithStyle({ MESSAGE: alias, STYLE: alias }, { target });

      const expectedPosition =
        canonicalDirectionPositions.get(canonicalDirection);
      expect(expectedPosition).toBeDefined();
      expect(last(positions)?.[0]).toBeCloseTo(expectedPosition?.[0] ?? 0);
      expect(last(positions)?.[1]).toBeCloseTo(expectedPosition?.[1] ?? 0);
    }
  });

  it("uses cardinal Scratch sprite directions from zero through 360", () => {
    const { extension, positions, target } = loadExtension();
    const cases: Array<[unknown, [number, number]]> = [
      [0, [-50, 92]],
      ["90", [22, 30]],
      [180, [-50, -32]],
      ["270", [-122, 30]],
      [360, [-50, 92]],
      ["+90", [22, 30]],
      ["-0", [-50, 92]],
    ];

    for (const [direction, expectedPosition] of cases) {
      const style = `degrees-${String(direction)}`;
      extension.defineStyle({
        ALIGN: "left",
        BACKGROUND: "#ffffff",
        DIRECTION: direction,
        FONT: "Helvetica",
        SIZE: 100,
        STYLE: style,
        TEXT_COLOR: "#575e75",
      });
      extension.sayWithStyle(
        { MESSAGE: String(direction), STYLE: style },
        { target },
      );

      expect(last(positions)?.[0]).toBeCloseTo(expectedPosition[0]);
      expect(last(positions)?.[1]).toBeCloseTo(expectedPosition[1]);
    }
  });

  it("preserves arbitrary Scratch angles across bubble aspect ratios", () => {
    const bubbleSizes: Array<[number, number]> = [
      [100, 60],
      [300, 60],
    ];

    for (const bubbleSize of bubbleSizes) {
      const { extension, positions, target } = loadExtension({ bubbleSize });
      for (const direction of [30.5, 45]) {
        const style = `degrees-${String(direction)}`;
        extension.defineStyle({
          ALIGN: "left",
          BACKGROUND: "#ffffff",
          DIRECTION: direction,
          FONT: "Helvetica",
          SIZE: 100,
          STYLE: style,
          TEXT_COLOR: "#575e75",
        });
        extension.sayWithStyle(
          { MESSAGE: String(direction), STYLE: style },
          { target },
        );

        const position = last(positions);
        expect(position).toBeDefined();
        expect(
          directionFromBubblePosition(position ?? [0, 0], bubbleSize),
        ).toBeCloseTo(direction, 8);
      }
    }
  });

  it("preserves angles from exponent-form numeric inputs", () => {
    const bubbleSize: [number, number] = [100, 60];
    const { extension, positions, target } = loadExtension({ bubbleSize });

    for (const [input, expectedDirection, precision] of [
      [1e-7, 1e-7, 6],
      ["1e2", 100, 8],
    ] as const) {
      const style = `degrees-${String(input)}`;
      extension.defineStyle({
        ALIGN: "left",
        BACKGROUND: "#ffffff",
        DIRECTION: input,
        FONT: "Helvetica",
        SIZE: 100,
        STYLE: style,
        TEXT_COLOR: "#575e75",
      });
      extension.sayWithStyle(
        { MESSAGE: String(input), STYLE: style },
        { target },
      );

      const position = last(positions);
      expect(position).toBeDefined();
      expect(
        directionFromBubblePosition(position ?? [0, 0], bubbleSize),
      ).toBeCloseTo(expectedDirection, precision);
    }
  });

  it("falls back to the default direction for invalid and out-of-range values", () => {
    const { extension, positions, target } = loadExtension();

    for (const direction of [
      -1,
      361,
      "90degrees",
      "constructor",
      "__proto__",
      Number.NaN,
    ]) {
      const style = `invalid-${String(direction)}`;
      extension.defineStyle({
        ALIGN: "left",
        BACKGROUND: "#ffffff",
        DIRECTION: direction,
        FONT: "Helvetica",
        SIZE: 100,
        STYLE: style,
        TEXT_COLOR: "#575e75",
      });
      extension.sayWithStyle(
        { MESSAGE: String(direction), STYLE: style },
        { target },
      );

      expect(last(positions)).toEqual([22, 92]);
    }
  });

  it("keeps the selected direction when the target moves", () => {
    const { extension, positions, setTargetBounds, target } = loadExtension();
    extension.defineStyle({
      ALIGN: "left",
      BACKGROUND: "#ffffff",
      DIRECTION: "down-right",
      FONT: "Helvetica",
      SIZE: 100,
      STYLE: "moving",
      TEXT_COLOR: "#575e75",
    });
    extension.sayWithStyle(
      { MESSAGE: "Follow me", STYLE: "moving" },
      { target },
    );
    expect(last(positions)).toEqual([22, -32]);

    setTargetBounds({ bottom: 40, left: 40, right: 60, top: 80 });
    target.onTargetVisualChange?.(target);
    expect(last(positions)).toEqual([72, 28]);
  });

  it("uses the default style when a requested name is missing", () => {
    const { extension, styleUpdates, target } = loadExtension();
    extension.sayWithStyle(
      { MESSAGE: "Fallback", STYLE: "does-not-exist" },
      { target },
    );
    expect(last(styleUpdates)).toMatchObject({
      bubbleFill: "#ffffff",
      fontSize: 14,
      textAlign: "left",
    });
  });

  it("redefines default for standard blocks and immediately restyles a visible bubble", () => {
    const { extension, getRedrawCount, runtime, styleUpdates, target } =
      loadExtension();
    runtime.emit("SAY", target, "say", "Visible");
    const redrawsBeforeDefinition = getRedrawCount();

    extension.defineStyle({
      ALIGN: "right",
      BACKGROUND: "#000000",
      DIRECTION: "up-right",
      FONT: "Verdana",
      SIZE: 125,
      STYLE: "default",
      TEXT_COLOR: "#ffffff",
    });
    expect(last(styleUpdates)).toMatchObject({
      bubbleFill: "#000000",
      font: "Verdana",
      fontSize: 17.5,
      textAlign: "right",
      textFill: "#ffffff",
    });
    expect(getRedrawCount()).toBe(redrawsBeforeDefinition + 1);

    runtime.emit("SAY", target, "think", "Standard after redefine");
    expect(last(styleUpdates)?.font).toBe("Verdana");
  });

  it("immediately reapplies a redefined named style to a visible bubble", () => {
    const { extension, styleUpdates, target } = loadExtension();
    extension.defineStyle({
      ALIGN: "left",
      BACKGROUND: "#ffffff",
      DIRECTION: "up-right",
      FONT: "Helvetica",
      SIZE: 100,
      STYLE: "character",
      TEXT_COLOR: "#575e75",
    });
    extension.sayWithStyle(
      { MESSAGE: "Still visible", STYLE: "character" },
      { target },
    );

    extension.defineStyle({
      ALIGN: "center",
      BACKGROUND: "#ffff00",
      DIRECTION: "up-right",
      FONT: "Arial",
      SIZE: 200,
      STYLE: "character",
      TEXT_COLOR: "#000000",
    });
    expect(last(styleUpdates)).toMatchObject({
      bubbleFill: "#ffff00",
      fontSize: 28,
      textAlign: "center",
    });
  });

  it("restyles and repositions a named-style bubble when the stage size changes", () => {
    const {
      extension,
      getRedrawCount,
      getRepositionCount,
      positions,
      runtime,
      setNativeSize,
      styleUpdates,
      target,
    } = loadExtension();
    extension.defineStyle({
      ALIGN: "left",
      BACKGROUND: "#ffffff",
      DIRECTION: "up-right",
      FONT: "Helvetica",
      SIZE: 150,
      STYLE: "large",
      TEXT_COLOR: "#575e75",
    });
    extension.sayWithStyle({ MESSAGE: "Hello", STYLE: "large" }, { target });
    expect(last(styleUpdates)?.fontSize).toBe(21);
    expect(last(positions)).toEqual([22, 92]);

    const redrawsBeforeResize = getRedrawCount();
    const repositionsBeforeResize = getRepositionCount();
    setNativeSize(960, 720);
    runtime.emit("STAGE_SIZE_CHANGED", 960, 720);

    expect(last(styleUpdates)?.fontSize).toBe(42);
    expect(last(positions)).toEqual([34, 104]);
    expect(getRedrawCount()).toBe(redrawsBeforeResize + 1);
    expect(getRepositionCount()).toBe(repositionsBeforeResize + 1);
  });

  it("uses safe defaults and limits for invalid style values", () => {
    const { extension, positions, styleUpdates, target } = loadExtension();
    extension.defineStyle({
      ALIGN: "diagonal",
      BACKGROUND: "not a color",
      DIRECTION: "not-a-direction",
      FONT: "bad;font",
      SIZE: 10_000,
      STYLE: "",
      TEXT_COLOR: "",
    });
    extension.sayWithStyle({ MESSAGE: "Safe", STYLE: "" }, { target });
    expect(last(styleUpdates)).toMatchObject({
      bubbleFill: "#ffffff",
      font: "Helvetica",
      fontSize: 140,
      textAlign: "left",
      textFill: "#575e75",
    });
    expect(last(positions)).toEqual([22, 92]);
  });

  it("keeps TurboWarp placement when drawable positioning is unavailable", () => {
    const { extension, positions, runtime, target } = loadExtension();
    delete runtime.renderer.getCurrentSkinSize;
    delete runtime.renderer.updateDrawablePosition;

    expect(() =>
      extension.sayWithStyle(
        { MESSAGE: "Standard position", STYLE: "default" },
        { target },
      ),
    ).not.toThrow();
    expect(positions).toHaveLength(0);
  });

  it("keeps legacy numeric-size opcodes executable", () => {
    const { extension, styleUpdates, target } = loadExtension();
    extension.say({ MESSAGE: "Small", SIZE: -100 }, { target });
    expect(last(styleUpdates)?.fontSize).toBe(0.14);
    extension.think({ MESSAGE: "Large", SIZE: 10_000 }, { target });
    expect(last(styleUpdates)?.fontSize).toBe(140);
  });

  it("draws centered and right-aligned text when renderer internals are compatible", () => {
    const { extension, fillTextCalls, originalTextFills, skin, target } =
      loadExtension({ supportsAlignmentRenderer: true });
    extension.defineStyle({
      ALIGN: "center",
      BACKGROUND: "#ffffff",
      DIRECTION: "up-right",
      FONT: "Helvetica",
      SIZE: 100,
      STYLE: "centered",
      TEXT_COLOR: "#112233",
    });
    extension.sayWithStyle(
      { MESSAGE: "Centered", STYLE: "centered" },
      { target },
    );
    skin._renderTextBubble?.(1);

    expect(originalTextFills).toEqual(["transparent"]);
    expect(fillTextCalls).toEqual([
      { text: "First", x: 50, y: 22.6 },
      { text: "Second", x: 50, y: 38.6 },
    ]);

    extension.defineStyle({
      ALIGN: "right",
      BACKGROUND: "#ffffff",
      DIRECTION: "up-right",
      FONT: "Helvetica",
      SIZE: 100,
      STYLE: "right-aligned",
      TEXT_COLOR: "#445566",
    });
    extension.sayWithStyle(
      { MESSAGE: "Right", STYLE: "right-aligned" },
      { target },
    );
    skin._renderTextBubble?.(1);
    expect(fillTextCalls.slice(-2).map((call) => call.x)).toEqual([90, 90]);
    expect(skin._style?.textFill).toBe("#445566");
  });

  it("safely keeps the renderer default alignment when private hooks are unavailable", () => {
    const { extension, styleUpdates, target } = loadExtension();
    extension.defineStyle({
      ALIGN: "right",
      BACKGROUND: "#ffffff",
      DIRECTION: "up-right",
      FONT: "Helvetica",
      SIZE: 100,
      STYLE: "right-aligned",
      TEXT_COLOR: "#575e75",
    });
    expect(() =>
      extension.sayWithStyle(
        { MESSAGE: "Fallback", STYLE: "right-aligned" },
        { target },
      ),
    ).not.toThrow();
    expect(last(styleUpdates)?.textAlign).toBe("right");
  });

  it("falls back without failing when TextBubbleSkin.setStyle is unavailable", () => {
    const { bubbleState, runtime, styleUpdates, target, textUpdates } =
      loadExtension({ supportsStyle: false });

    expect(() =>
      runtime.emit("SAY", target, "say", "Line 1\\nLine 2"),
    ).not.toThrow();
    expect(bubbleState.text).toBe("Line 1\nLine 2");
    expect(textUpdates).toHaveLength(1);
    expect(styleUpdates).toHaveLength(0);
  });
});
