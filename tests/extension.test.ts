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

interface LoadedExtension {
  bubbleState: TextBubbleState;
  extension: ScalableBubblesExtension;
  getRedrawCount(): number;
  getRepositionCount(): number;
  runtime: TestRuntime;
  setNativeSize(width: number, height: number): void;
  styleUpdates: Array<Record<string, number>>;
  target: TurboWarpTarget;
  textUpdates: unknown[][];
}

beforeEach(() => {
  vi.stubGlobal("Scratch", {
    ArgumentType: { BOOLEAN: "boolean", NUMBER: "number", STRING: "string" },
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
  supportsStyle = true,
}: { supportsStyle?: boolean } = {}): LoadedExtension {
  const events = new EventEmitter();
  const bubbleState: TextBubbleState = {
    onSpriteRight: true,
    skinId: 1,
    text: "",
    type: "say",
  };
  const styleUpdates: Array<Record<string, number>> = [];
  const textUpdates: unknown[][] = [];
  const skin: TextBubbleSkin = supportsStyle
    ? {
        setStyle(style) {
          styleUpdates.push(style);
        },
      }
    : {};
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
    getRedrawCount: () => redrawCount,
    getRepositionCount: () => repositionCount,
    runtime,
    setNativeSize: (width, height) => {
      nativeSize = [width, height];
    },
    styleUpdates,
    target,
    textUpdates,
  };
}

function last<T>(values: T[]): T | undefined {
  return values[values.length - 1];
}

describe("ScalableBubblesExtension", () => {
  it("registers say and think blocks with a size-100 default", () => {
    const { extension } = loadExtension();
    const info = extension.getInfo() as {
      id: string;
      name: string;
      docsURI: string;
      blocks: Array<{
        opcode: string;
        arguments: { SIZE: { defaultValue: number } };
      }>;
    };

    expect(info.id).toBe("kubohiroyascalablebubbles");
    expect(info.name).toBe("Scalable Bubbles");
    expect(info.docsURI).toBe(EXTENSION_DOCS_URI);
    expect(EXTENSION_DOCS_URI).toBe(
      "https://kubohiroya.github.io/turbowarp-scale-bubbles/",
    );
    expect(
      info.blocks.map((block) => [
        block.opcode,
        block.arguments.SIZE.defaultValue,
      ]),
    ).toEqual([
      ["say", 100],
      ["think", 100],
    ]);
  });

  it("keeps standard say, think, and ask bubbles proportional at size 100", () => {
    const { bubbleState, runtime, setNativeSize, styleUpdates, target } =
      loadExtension();

    runtime.emit("SAY", target, "say", "Hello");
    expect(last(styleUpdates)).toMatchObject({
      fontSize: 14,
      lineHeight: 16,
      maxLineWidth: 170,
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

  it("supports relative font sizes and escaped multiline text", () => {
    const {
      bubbleState,
      extension,
      runtime,
      setNativeSize,
      styleUpdates,
      target,
      textUpdates,
    } = loadExtension();
    setNativeSize(960, 720);

    runtime.emit("SAY", target, "say", "Standard 1\\nStandard 2");
    expect(bubbleState.text).toBe("Standard 1\nStandard 2");
    expect(last(textUpdates)?.[2]).toBe("Standard 1\nStandard 2");

    extension.say({ MESSAGE: "Line 1\\nLine 2", SIZE: 150 }, { target });
    expect(bubbleState.text).toBe("Line 1\nLine 2");
    expect(last(styleUpdates)?.fontSize).toBe(42);

    extension.think({ MESSAGE: "Small", SIZE: 50 }, { target });
    expect(bubbleState.type).toBe("think");
    expect(last(styleUpdates)?.fontSize).toBe(14);
  });

  it("restyles and repositions a visible bubble when the stage size changes", () => {
    const {
      extension,
      getRedrawCount,
      getRepositionCount,
      runtime,
      setNativeSize,
      styleUpdates,
      target,
    } = loadExtension();
    extension.say({ MESSAGE: "Hello", SIZE: 150 }, { target });
    expect(last(styleUpdates)?.fontSize).toBe(21);

    const redrawsBeforeResize = getRedrawCount();
    const repositionsBeforeResize = getRepositionCount();
    setNativeSize(960, 720);
    runtime.emit("STAGE_SIZE_CHANGED", 960, 720);

    expect(last(styleUpdates)?.fontSize).toBe(42);
    expect(getRedrawCount()).toBe(redrawsBeforeResize + 1);
    expect(getRepositionCount()).toBe(repositionsBeforeResize + 1);
  });

  it("uses safe defaults and limits for invalid font sizes", () => {
    const { extension, styleUpdates, target } = loadExtension();
    extension.say({ MESSAGE: "Default", SIZE: "" }, { target });
    expect(last(styleUpdates)?.fontSize).toBe(14);
    extension.say({ MESSAGE: "Default", SIZE: Number.NaN }, { target });
    expect(last(styleUpdates)?.fontSize).toBe(14);
    extension.say({ MESSAGE: "Minimum", SIZE: -100 }, { target });
    expect(last(styleUpdates)?.fontSize).toBe(0.14);
    extension.say({ MESSAGE: "Maximum", SIZE: 10000 }, { target });
    expect(last(styleUpdates)?.fontSize).toBe(140);
  });

  it("falls back without failing when TextBubbleSkin.setStyle is unavailable", () => {
    const { bubbleState, runtime, styleUpdates, target, textUpdates } =
      loadExtension({
        supportsStyle: false,
      });

    expect(() =>
      runtime.emit("SAY", target, "say", "Line 1\\nLine 2"),
    ).not.toThrow();
    expect(bubbleState.text).toBe("Line 1\nLine 2");
    expect(textUpdates).toHaveLength(1);
    expect(styleUpdates).toHaveLength(0);
  });
});
