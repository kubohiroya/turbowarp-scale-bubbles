import { beforeEach, describe, expect, it, vi } from "vitest";
import { BLOCK_ICON_URI, SvgTextExtension } from "../src/extension.js";

interface RuntimeHarness {
  created: string[];
  destroyed: number[];
  renderer: TurboWarpRenderer;
  runtime: TurboWarpRuntime;
  target: TurboWarpTarget;
  emitStageSizeChanged(): void;
}

function scratch(): ScratchApi {
  return {
    ArgumentType: {
      BOOLEAN: "boolean",
      COLOR: "color",
      NUMBER: "number",
      STRING: "string",
    },
    BlockType: {
      COMMAND: "command",
      REPORTER: "reporter",
      BOOLEAN: "boolean",
      HAT: "hat",
    },
    Cast: {
      toBoolean: (value) => Boolean(value),
      toNumber: (value) => Number(value),
      toString: (value) => String(value),
    },
    extensions: { register: vi.fn(), unsandboxed: true },
    translate: (value) => (typeof value === "string" ? value : value.default),
  };
}

function harness(): RuntimeHarness {
  let nextSkinId = 1;
  const created: string[] = [];
  const destroyed: number[] = [];
  let stageSizeChanged: (() => void) | undefined;
  const renderer: TurboWarpRenderer = {
    createSVGSkin: vi.fn((svg) => {
      created.push(svg);
      return nextSkinId++;
    }),
    destroySkin: vi.fn((skinId) => {
      destroyed.push(skinId);
    }),
    getNativeSize: vi.fn(() => [480, 360]),
    updateDrawableSkinId: vi.fn(),
  };
  const target: TurboWarpTarget = { drawableID: 7 };
  const runtime: TurboWarpRuntime = {
    renderer,
    on(event, listener) {
      if (event === "STAGE_SIZE_CHANGED") stageSizeChanged = listener;
    },
    requestRedraw: vi.fn(),
  };
  return {
    created,
    destroyed,
    renderer,
    runtime,
    target,
    emitStageSizeChanged() {
      stageSizeChanged?.();
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("Scratch", scratch());
});

describe("SVG Text extension", () => {
  it("publishes only text style and text actor blocks", () => {
    const extension = new SvgTextExtension(harness().runtime);
    const info = extension.getInfo() as {
      blockIconURI: string;
      blocks: Array<{ opcode: string }>;
      menus: Record<string, unknown>;
    };
    expect(info.blocks.map(({ opcode }) => opcode)).toEqual([
      "defineStyle",
      "setText",
    ]);
    expect(info.menus).toHaveProperty("alignment");
    expect(info.menus).not.toHaveProperty("direction");
    expect(info.blockIconURI).toBe(BLOCK_ICON_URI);
    const iconSvg = decodeURIComponent(
      BLOCK_ICON_URI.slice("data:image/svg+xml,".length),
    );
    expect(iconSvg).toContain('viewBox="0 0 64 64"');
    expect(iconSvg).toContain("M22 23h20M32 23v23");
    expect(iconSvg).not.toContain("<rect");
  });

  it("renders escaped multiline text with a named style", () => {
    const fake = harness();
    const extension = new SvgTextExtension(fake.runtime);
    extension.defineStyle({
      STYLE: "title",
      BACKGROUND: "transparent",
      TEXT_COLOR: "#ffffff",
      FONT: "Noto Sans JP",
      SIZE: 150,
      ALIGN: "center",
    });
    extension.setText(
      { STYLE: "title", TEXT: "海へ<出発>！\\n二行目" },
      { target: fake.target },
    );

    expect(fake.created[0]).toContain('fill="transparent"');
    expect(fake.created[0]).toContain('fill="#ffffff"');
    expect(fake.created[0]).toContain('font-family="Noto Sans JP"');
    expect(fake.created[0]).toContain('font-size="21"');
    expect(fake.created[0]).toContain('text-anchor="middle"');
    expect(fake.created[0]).toContain("海へ&lt;出発&gt;！");
    expect(fake.created[0]?.match(/<tspan/gu)).toHaveLength(2);
    expect(extension.measureText("title", "海へ<出発>！")).toBeGreaterThan(0);
  });

  it("hands off current named styles without creating renderer resources", () => {
    const fake = harness();
    const extension = new SvgTextExtension(fake.runtime);
    extension.defineStyle({
      STYLE: "dialogue",
      BACKGROUND: "transparent",
      TEXT_COLOR: "#123456",
      FONT: "Noto Sans JP",
      SIZE: 150,
      ALIGN: "right",
    });

    const capability = extension.getLayoutCapability();
    const first = capability.layoutText({
      nativeSize: [480, 360],
      styleName: "dialogue",
      text: "named style",
    });

    expect(extension.getLayoutCapability()).toBe(capability);
    expect(Object.isFrozen(capability)).toBe(true);
    expect(first.style).toMatchObject({
      alignment: "right",
      backgroundColor: "transparent",
      font: "Noto Sans JP",
      fontPercent: 150,
      textColor: "#123456",
    });
    expect(fake.created).toHaveLength(0);
    expect(fake.renderer.updateDrawableSkinId).not.toHaveBeenCalled();

    extension.defineStyle({
      STYLE: "dialogue",
      BACKGROUND: "transparent",
      TEXT_COLOR: "#abcdef",
      FONT: "Helvetica",
      SIZE: 80,
      ALIGN: "center",
    });
    const redefined = capability.layoutText({
      nativeSize: [480, 360],
      styleName: "dialogue",
      text: "named style",
    });
    expect(redefined.style).toMatchObject({
      alignment: "center",
      font: "Helvetica",
      fontPercent: 80,
      textColor: "#abcdef",
    });
    expect(redefined.style.fontSize).not.toBe(first.style.fontSize);
    expect(fake.created).toHaveLength(0);
  });

  it("validates public layout capability input", () => {
    const capability = new SvgTextExtension(
      harness().runtime,
    ).getLayoutCapability();
    expect(() =>
      capability.layoutText({
        nativeSize: [0, 360],
        styleName: "default",
        text: "invalid",
      }),
    ).toThrow("two positive finite numbers");
  });

  it("restyles existing text actors and responds to stage size changes", () => {
    const fake = harness();
    const extension = new SvgTextExtension(fake.runtime);
    extension.setText(
      { STYLE: "default", TEXT: "first" },
      { target: fake.target },
    );
    extension.defineStyle({
      STYLE: "default",
      BACKGROUND: "#000000",
      TEXT_COLOR: "#ffffff",
      FONT: "Helvetica",
      SIZE: 100,
      ALIGN: "left",
    });
    expect(fake.destroyed).toEqual([1]);
    expect(fake.created).toHaveLength(2);

    fake.emitStageSizeChanged();
    expect(fake.created).toHaveLength(3);
    expect(fake.destroyed).toEqual([1, 2]);
  });

  it("releases text actor skins and rejects missing SVG skin APIs", () => {
    const fake = harness();
    const extension = new SvgTextExtension(fake.runtime);
    extension.setText(
      { STYLE: "default", TEXT: "first" },
      { target: fake.target },
    );
    expect(extension.releaseTextActor(fake.target)).toBe(true);
    expect(extension.releaseTextActor(fake.target)).toBe(false);
    expect(fake.destroyed).toEqual([1]);

    const brokenRuntime = {
      ...fake.runtime,
      renderer: { getNativeSize: () => [480, 360] },
    } as TurboWarpRuntime;
    expect(() =>
      new SvgTextExtension(brokenRuntime).setText(
        { STYLE: "default", TEXT: "text" },
        { target: fake.target },
      ),
    ).toThrow(/SVG skin APIs/u);
  });
});
