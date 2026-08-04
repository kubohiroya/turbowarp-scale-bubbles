import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXTENSION_DOCS_URI,
  ScalableBubblesExtension,
} from "../src/extension.js";

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
  bubbleState: TextBubbleState;
  extension: ScalableBubblesExtension;
  fillTextCalls: FillTextCall[];
  getRedrawCount(): number;
  getRepositionCount(): number;
  originalTextFills: Array<string | undefined>;
  runtime: TestRuntime;
  setNativeSize(width: number, height: number): void;
  skin: TextBubbleSkin;
  styleUpdates: TextBubbleRenderStyle[];
  target: TurboWarpTarget;
  textUpdates: unknown[][];
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
  supportsAlignmentRenderer = false,
  supportsStyle = true,
}: {
  supportsAlignmentRenderer?: boolean;
  supportsStyle?: boolean;
} = {}): LoadedExtension {
  const events = new EventEmitter();
  const bubbleState: TextBubbleState = {
    onSpriteRight: true,
    skinId: 1,
    text: "",
    type: "say",
  };
  const styleUpdates: TextBubbleRenderStyle[] = [];
  const textUpdates: unknown[][] = [];
  const fillTextCalls: FillTextCall[] = [];
  const originalTextFills: Array<string | undefined> = [];
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
  let repositionCount = 0;
  let redrawCount = 0;
  const renderer: TurboWarpRenderer = {
    _allSkins: { 1: skin },
    getNativeSize: () => nativeSize,
    updateTextSkin: (...args) => textUpdates.push(args),
  };
  const target: TurboWarpTarget = {
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

  const extension = new ScalableBubblesExtension(runtime);
  return {
    bubbleState,
    extension,
    fillTextCalls,
    getRedrawCount: () => redrawCount,
    getRepositionCount: () => repositionCount,
    originalTextFills,
    runtime,
    setNativeSize: (width, height) => {
      nativeSize = [width, height];
    },
    skin,
    styleUpdates,
    target,
    textUpdates,
  };
}

function last<T>(values: T[]): T | undefined {
  return values[values.length - 1];
}

describe("ScalableBubblesExtension", () => {
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

    expect(info.id).toBe("kubohiroyascalablebubbles");
    expect(info.name).toBe("Scalable Bubbles");
    expect(info.docsURI).toBe(EXTENSION_DOCS_URI);
    expect(EXTENSION_DOCS_URI).toBe(
      "https://kubohiroya.github.io/turbowarp-scale-bubbles/",
    );
    expect(info.blocks.map((block) => block.opcode)).toEqual([
      "defineStyle",
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
    expect(info.menus.alignment).toEqual({
      acceptReporters: true,
      items: ["left", "center", "right"],
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
      runtime,
      setNativeSize,
      styleUpdates,
      target,
    } = loadExtension();
    extension.defineStyle({
      ALIGN: "left",
      BACKGROUND: "#ffffff",
      FONT: "Helvetica",
      SIZE: 150,
      STYLE: "large",
      TEXT_COLOR: "#575e75",
    });
    extension.sayWithStyle({ MESSAGE: "Hello", STYLE: "large" }, { target });
    expect(last(styleUpdates)?.fontSize).toBe(21);

    const redrawsBeforeResize = getRedrawCount();
    const repositionsBeforeResize = getRepositionCount();
    setNativeSize(960, 720);
    runtime.emit("STAGE_SIZE_CHANGED", 960, 720);

    expect(last(styleUpdates)?.fontSize).toBe(42);
    expect(getRedrawCount()).toBe(redrawsBeforeResize + 1);
    expect(getRepositionCount()).toBe(repositionsBeforeResize + 1);
  });

  it("uses safe defaults and limits for invalid style values", () => {
    const { extension, styleUpdates, target } = loadExtension();
    extension.defineStyle({
      ALIGN: "diagonal",
      BACKGROUND: "not a color",
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
