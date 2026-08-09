import { describe, expect, it } from "vitest";
import {
  createSvgTextComposition,
  type SvgTextCompositionRenderer,
  type SvgTextCompositionRuntime,
} from "../src/composition.js";

interface FakePlatform {
  created: string[];
  destroyed: number[];
  drawableUpdates: Array<[number, number]>;
  getRedrawCount(): number;
  renderer: SvgTextCompositionRenderer;
  runtime: SvgTextCompositionRuntime;
}

function fakePlatform(
  overrides: Partial<SvgTextCompositionRenderer> = {},
): FakePlatform {
  const created: string[] = [];
  const destroyed: number[] = [];
  const drawableUpdates: Array<[number, number]> = [];
  let nextSkinId = 1;
  let redrawCount = 0;
  const renderer: SvgTextCompositionRenderer = {
    createSVGSkin(svg) {
      created.push(svg);
      return nextSkinId++;
    },
    destroySkin(skinId) {
      destroyed.push(skinId);
    },
    getNativeSize() {
      return [480, 360];
    },
    updateDrawableSkinId(drawableId, skinId) {
      drawableUpdates.push([drawableId, skinId]);
    },
    ...overrides,
  };
  return {
    created,
    destroyed,
    drawableUpdates,
    getRedrawCount: () => redrawCount,
    renderer,
    runtime: {
      renderer,
      requestRedraw() {
        redrawCount += 1;
      },
    },
  };
}

describe("SVG Text composition API", () => {
  it("defines a style and renders escaped multiline text without global Scratch", () => {
    const fake = fakePlatform();
    const composition = createSvgTextComposition({ runtime: fake.runtime });
    const target = { drawableID: 7 };

    composition.defineStyle({
      name: " title ",
      alignment: "center",
      backgroundColor: "#112233",
      font: "Noto Sans JP",
      fontPercent: 150,
      textColor: "#ffffff",
    });
    composition.setText({
      styleName: "title",
      target,
      text: "海へ<出発>！\\n二行目",
    });

    expect(Object.isFrozen(composition)).toBe(true);
    expect(fake.drawableUpdates).toEqual([[7, 1]]);
    expect(fake.created[0]).toContain('fill="#112233"');
    expect(fake.created[0]).toContain('fill="#ffffff"');
    expect(fake.created[0]).toContain('font-family="Noto Sans JP"');
    expect(fake.created[0]).toContain('font-size="21"');
    expect(fake.created[0]).toContain('text-anchor="middle"');
    expect(fake.created[0]).toContain("海へ&lt;出発&gt;！");
    expect(fake.created[0]).toContain("二行目");
    expect(fake.created[0]?.match(/<tspan/gu)).toHaveLength(2);
    expect(fake.getRedrawCount()).toBe(1);
    expect(
      composition.measureText({ styleName: "title", text: "海へ<出発>！" }),
    ).toBeGreaterThan(0);
  });

  it("replaces and releases an owned target skin exactly once", () => {
    const fake = fakePlatform();
    const composition = createSvgTextComposition({ runtime: fake.runtime });
    const target = { drawableID: 3 };

    composition.setText({ styleName: "default", target, text: "first" });
    composition.setText({ styleName: "default", target, text: "second" });
    expect(fake.destroyed).toEqual([1]);

    composition.releaseTarget(target);
    expect(fake.destroyed).toEqual([1, 2]);
    expect(() => composition.releaseTarget(target)).toThrow(/not owned/u);
    composition.releaseAll();
    composition.releaseAll();
    expect(fake.destroyed).toEqual([1, 2]);
  });

  it("releases a failed replacement skin while preserving previous ownership", () => {
    let updates = 0;
    const fake = fakePlatform({
      updateDrawableSkinId() {
        updates += 1;
        if (updates === 2) throw new Error("renderer update failed");
      },
    });
    const composition = createSvgTextComposition({ runtime: fake.runtime });
    const target = { drawableID: 4 };
    composition.setText({ styleName: "default", target, text: "first" });

    expect(() =>
      composition.setText({ styleName: "default", target, text: "second" }),
    ).toThrow(/renderer update failed/u);
    expect(fake.destroyed).toEqual([2]);

    composition.releaseAll();
    expect(fake.destroyed).toEqual([2, 1]);
  });

  it("releases all targets, is idempotent, and rejects mutation after disposal", () => {
    const fake = fakePlatform();
    const composition = createSvgTextComposition({ runtime: fake.runtime });
    const first = { drawableID: 1 };
    const second = { drawableID: 2 };
    composition.setText({ styleName: "default", target: first, text: "one" });
    composition.setText({ styleName: "default", target: second, text: "two" });

    composition.releaseAll();
    composition.releaseAll();
    expect(fake.destroyed).toEqual([1, 2]);
    expect(() => composition.defineStyle({ name: "later" })).toThrow(
      /released/u,
    );
    expect(() =>
      composition.setText({
        styleName: "default",
        target: first,
        text: "later",
      }),
    ).toThrow(/released/u);
    expect(() => composition.releaseTarget(first)).toThrow(/released/u);
  });

  it("keeps styles and target ownership isolated between instances", () => {
    const firstFake = fakePlatform();
    const secondFake = fakePlatform();
    const first = createSvgTextComposition({ runtime: firstFake.runtime });
    const second = createSvgTextComposition({ runtime: secondFake.runtime });
    const firstTarget = { drawableID: 10 };
    const secondTarget = { drawableID: 20 };
    first.defineStyle({ name: "shared", textColor: "#ff0000" });
    second.defineStyle({ name: "shared", textColor: "#0000ff" });
    first.setText({ styleName: "shared", target: firstTarget, text: "first" });
    second.setText({
      styleName: "shared",
      target: secondTarget,
      text: "second",
    });

    expect(firstFake.created[0]).toContain('fill="#ff0000"');
    expect(secondFake.created[0]).toContain('fill="#0000ff"');
    expect(() => first.releaseTarget(secondTarget)).toThrow(/not owned/u);
    second.releaseAll();
    expect(firstFake.destroyed).toEqual([]);
    first.releaseAll();
  });

  it("strictly rejects malformed dependencies, styles, actors, and renderer results", () => {
    expect(() =>
      createSvgTextComposition({ runtime: {} as SvgTextCompositionRuntime }),
    ).toThrow(/renderer/u);
    expect(() =>
      createSvgTextComposition({
        runtime: { renderer: {} } as SvgTextCompositionRuntime,
      }),
    ).toThrow(/must provide/u);
    const fake = fakePlatform();
    const composition = createSvgTextComposition({ runtime: fake.runtime });
    const invalidStyles = [
      {},
      { name: "" },
      { name: "bad", alignment: "middle" },
      { name: "bad", fontPercent: 0 },
      { name: "bad", backgroundColor: "" },
      { name: "bad", extra: true },
    ];
    for (const style of invalidStyles) {
      expect(() => composition.defineStyle(style as never)).toThrow();
    }
    expect(() =>
      composition.setText({
        styleName: "missing",
        target: { drawableID: 1 },
        text: "text",
      }),
    ).toThrow(/not defined/u);
    expect(() =>
      composition.setText({
        styleName: "default",
        target: { drawableID: -1 },
        text: "text",
      }),
    ).toThrow(/drawableID/u);
    expect(fake.created).toEqual([]);

    const invalidSkin = fakePlatform({ createSVGSkin: () => Number.NaN });
    const invalidComposition = createSvgTextComposition({
      runtime: invalidSkin.runtime,
    });
    expect(() =>
      invalidComposition.setText({
        styleName: "default",
        target: { drawableID: 1 },
        text: "text",
      }),
    ).toThrow(/did not create/u);
  });
});
