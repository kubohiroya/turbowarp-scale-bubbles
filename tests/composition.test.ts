import { describe, expect, it } from "vitest";
import {
  createSvgTextComposition,
  createSvgTextLayoutComposition,
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

function svgNumber(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

describe("SVG Text composition API", () => {
  it("returns synchronous host-neutral layout without renderer skin APIs", () => {
    const composition = createSvgTextLayoutComposition();
    composition.defineStyle({
      name: " title ",
      alignment: "center",
      backgroundColor: "#112233",
      font: "Noto Sans JP",
      fontPercent: 150,
      textColor: "#ffffff",
    });

    const layout = composition.layoutText({
      styleName: "title",
      text: "A<&\\n日本語",
      nativeSize: [960, 720],
    });

    expect(layout).toEqual({
      height: 144,
      lines: [
        {
          baseline: 66,
          text: "A<&",
          width: 78.11999999999999,
          x: 87,
        },
        { baseline: 114, text: "日本語", width: 126, x: 87 },
      ],
      preserveWhitespace: true,
      style: {
        alignment: "center",
        backgroundColor: "#112233",
        cornerRadius: 16,
        font: "Noto Sans JP",
        fontPercent: 150,
        fontSize: 42,
        lineHeight: 48,
        padding: 24,
        textColor: "#ffffff",
      },
      width: 174,
    });
    expect(Object.isFrozen(composition)).toBe(true);
    expect(Object.isFrozen(layout)).toBe(true);
    expect(Object.isFrozen(layout.lines)).toBe(true);
    expect(Object.isFrozen(layout.lines[0])).toBe(true);
    expect(Object.isFrozen(layout.style)).toBe(true);
  });

  it("returns only the documented data contract for untrusted text", () => {
    const composition = createSvgTextLayoutComposition();
    composition.defineStyle({
      name: "safe",
      backgroundColor: "url(javascript:alert(1))",
      font: "bad;font",
      textColor: "not-a-color",
    });
    const text = '<foreignObject onload="alert(1)"><script>';
    const layout = composition.layoutText({
      styleName: "safe",
      text,
      nativeSize: [480, 360],
    });

    expect(layout.lines[0]?.text).toBe(text);
    expect(layout.style).toMatchObject({
      backgroundColor: "#ffffff",
      font: "Helvetica",
      textColor: "#575e75",
    });
    expect(Object.keys(layout).sort()).toEqual([
      "height",
      "lines",
      "preserveWhitespace",
      "style",
      "width",
    ]);
    expect(Object.keys(layout.lines[0] ?? {}).sort()).toEqual([
      "baseline",
      "text",
      "width",
      "x",
    ]);
    expect(Object.keys(layout.style).sort()).toEqual([
      "alignment",
      "backgroundColor",
      "cornerRadius",
      "font",
      "fontPercent",
      "fontSize",
      "lineHeight",
      "padding",
      "textColor",
    ]);
    expect(JSON.parse(JSON.stringify(layout))).toEqual(layout);
  });

  it("keeps host-neutral layout visually identical to renderer-backed SVG", () => {
    const fake = fakePlatform({ getNativeSize: () => [960, 720] });
    const composition = createSvgTextComposition({ runtime: fake.runtime });
    const target = { drawableID: 9 };
    composition.defineStyle({
      name: "overlay",
      alignment: "right",
      backgroundColor: "#102030",
      font: "Noto Sans JP",
      fontPercent: 125,
      textColor: "#f0e0d0",
    });
    const input = {
      styleName: "overlay",
      text: "  A<&  \\n日本語",
      nativeSize: [960, 720] as const,
    };

    const layout = composition.layoutText(input);
    composition.setText({
      styleName: input.styleName,
      target,
      text: input.text,
    });
    const svg = fake.created[0] ?? "";

    expect(svg).toContain(`width="${layout.width}"`);
    expect(svg).toContain(`height="${layout.height}"`);
    expect(svg).toContain(`rx="${layout.style.cornerRadius}"`);
    expect(svg).toContain(`fill="${layout.style.backgroundColor}"`);
    expect(svg).toContain(`fill="${layout.style.textColor}"`);
    expect(svg).toContain(`font-family="${layout.style.font}"`);
    expect(svg).toContain(`font-size="${layout.style.fontSize}"`);
    expect(svg).toContain('text-anchor="end"');
    expect(svg).toContain('xml:space="preserve"');
    for (const line of layout.lines) {
      expect(svg).toContain(`<tspan x="${line.x}" y="${line.baseline}">`);
    }
    expect(svg).toContain("  A&lt;&amp;  ");
    expect(layout.lines[0]?.text).toBe("  A<&  ");
    expect(
      composition.measureText({
        styleName: input.styleName,
        text: input.text,
      }),
    ).toBe(Math.max(...layout.lines.map((line) => line.width)));
  });

  it("lays out ruby as frozen host-neutral geometry with deterministic projections", () => {
    const composition = createSvgTextLayoutComposition();
    composition.defineStyle({
      name: "ruby",
      font: "Noto Sans JP",
      rubyFontPercent: 50,
      rubyGap: 1,
    });
    const layout = composition.layoutRichText({
      styleName: "ruby",
      runs: [
        { type: "text", text: "海へ" },
        { type: "ruby", base: "出発", reading: "しゅっぱつ" },
        { type: "text", text: "！" },
      ],
      nativeSize: [480, 360],
    });

    expect(layout).toMatchObject({
      height: 48,
      overflow: false,
      plainText: "海へ出発！",
      preserveWhitespace: true,
      readingText: "海へしゅっぱつ！",
      style: {
        font: "Noto Sans JP",
        fontSize: 14,
        lineHeight: 16,
        padding: 12,
        rubyFontPercent: 50,
        rubyFontSize: 7,
        rubyGap: 1,
      },
      width: 101,
    });
    expect(layout.lines).toHaveLength(1);
    expect(layout.lines[0]).toMatchObject({
      ascent: 22,
      baseline: 34,
      descent: 2,
      height: 24,
      overflow: false,
      width: 77,
      x: 12,
    });
    expect(layout.lines[0]?.fragments).toEqual([
      {
        baseline: 34,
        revealIndex: 0,
        text: "海",
        type: "text",
        width: 14,
        x: 12,
      },
      {
        baseline: 34,
        revealIndex: 1,
        text: "へ",
        type: "text",
        width: 14,
        x: 26,
      },
      {
        base: {
          baseline: 34,
          fontSize: 14,
          text: "出発",
          width: 28,
          x: 43.5,
        },
        reading: {
          baseline: 19,
          fontSize: 7,
          text: "しゅっぱつ",
          width: 35,
          x: 40,
        },
        revealIndex: 2,
        type: "ruby",
        width: 35,
        x: 40,
      },
      {
        baseline: 34,
        revealIndex: 3,
        text: "！",
        type: "text",
        width: 14,
        x: 75,
      },
    ]);
    expect(layout.revealUnits).toEqual([
      { end: 1, index: 0, runIndex: 0, start: 0, type: "text" },
      { end: 2, index: 1, runIndex: 0, start: 1, type: "text" },
      { end: 2, index: 2, runIndex: 1, start: 0, type: "ruby" },
      { end: 1, index: 3, runIndex: 2, start: 0, type: "text" },
    ]);
    expect(Object.isFrozen(layout)).toBe(true);
    expect(Object.isFrozen(layout.lines)).toBe(true);
    expect(Object.isFrozen(layout.lines[0])).toBe(true);
    expect(Object.isFrozen(layout.lines[0]?.fragments)).toBe(true);
    const ruby = layout.lines[0]?.fragments[2];
    expect(ruby?.type).toBe("ruby");
    if (ruby?.type === "ruby") {
      expect(Object.isFrozen(ruby.base)).toBe(true);
      expect(Object.isFrozen(ruby.reading)).toBe(true);
    }
    expect(Object.isFrozen(layout.revealUnits)).toBe(true);
    expect(Object.isFrozen(layout.revealUnits[0])).toBe(true);
    expect(JSON.parse(JSON.stringify(layout))).toEqual(layout);
  });

  it("wraps text graphemes without splitting an atomic ruby group", () => {
    const composition = createSvgTextLayoutComposition();
    const runs = [
      { type: "text", text: "海へ" },
      { type: "ruby", base: "出発", reading: "しゅっぱつ" },
      { type: "text", text: "！" },
    ] as const;
    const layout = composition.layoutRichText({
      styleName: "default",
      runs,
      nativeSize: [480, 360],
      maxWidth: 60,
    });

    expect(layout).toMatchObject({ height: 80, overflow: false, width: 60 });
    expect(layout.lines.map((line) => line.width)).toEqual([28, 35, 14]);
    expect(layout.lines.map((line) => line.baseline)).toEqual([26, 50, 66]);
    expect(layout.lines[1]?.fragments).toHaveLength(1);
    expect(layout.lines[1]?.fragments[0]?.type).toBe("ruby");

    const overflow = composition.layoutRichText({
      styleName: "default",
      runs: [{ type: "ruby", base: "語", reading: "ながすぎるよみかた" }],
      nativeSize: [480, 360],
      maxWidth: 60,
    });
    expect(overflow.overflow).toBe(true);
    expect(overflow.lines[0]?.overflow).toBe(true);
    expect(overflow.width).toBeGreaterThan(60);
  });

  it("normalizes rich line endings and preserves grapheme source ranges", () => {
    const composition = createSvgTextLayoutComposition();
    const layout = composition.layoutRichText({
      styleName: "default",
      runs: [{ type: "text", text: "A\u0301👩‍💻\r\nB\\nC" }],
      nativeSize: [360, 640],
    });

    expect(layout.plainText).toBe("A\u0301👩‍💻\nB\nC");
    expect(layout.readingText).toBe(layout.plainText);
    expect(layout.lines).toHaveLength(3);
    expect(layout.revealUnits.slice(0, 2)).toEqual([
      { end: 2, index: 0, runIndex: 0, start: 0, type: "text" },
      { end: 7, index: 1, runIndex: 0, start: 2, type: "text" },
    ]);
  });

  it("keeps rich host-neutral geometry identical to renderer-backed SVG", () => {
    const fake = fakePlatform();
    const composition = createSvgTextComposition({ runtime: fake.runtime });
    const target = { drawableID: 11 };
    const runs = [
      { type: "text", text: "  海<&" },
      { type: "ruby", base: "出発", reading: "しゅっぱつ" },
    ] as const;
    composition.defineStyle({
      name: "ruby",
      alignment: "center",
      backgroundColor: "transparent",
      font: "Noto Sans JP",
      rubyFontPercent: 50,
      rubyGap: 2,
      textColor: "#332200",
    });
    const layout = composition.layoutRichText({
      styleName: "ruby",
      runs,
      nativeSize: [480, 360],
    });

    composition.setRichText({ styleName: "ruby", target, runs });
    const svg = fake.created[0] ?? "";
    expect(svg).toContain(`width="${layout.width}"`);
    expect(svg).toContain(`height="${layout.height}"`);
    expect(svg).toContain("<title>  海&lt;&amp;出発</title>");
    expect(svg).toContain('xml:space="preserve"');
    expect(svg).toContain('text-anchor="start"');
    for (const line of layout.lines) {
      for (const fragment of line.fragments) {
        if (fragment.type === "text") {
          expect(svg).toContain(
            `<tspan x="${svgNumber(fragment.x)}" y="${svgNumber(fragment.baseline)}"`,
          );
        } else {
          expect(svg).toContain(
            `<tspan x="${svgNumber(fragment.reading.x)}" y="${svgNumber(fragment.reading.baseline)}"`,
          );
          expect(svg).toContain(
            `<tspan x="${svgNumber(fragment.base.x)}" y="${svgNumber(fragment.base.baseline)}"`,
          );
        }
      }
    }
    expect(svg).toContain("  ");
    expect(svg).toContain("海&lt;&amp;");
    expect(svg).toContain("しゅっぱつ");
    expect(composition.measureRichText({ styleName: "ruby", runs })).toBe(
      Math.max(...layout.lines.map((line) => line.width)),
    );

    composition.setText({ styleName: "ruby", target, text: "plain" });
    expect(fake.destroyed).toEqual([1]);
    composition.releaseAll();
    expect(fake.destroyed).toEqual([1, 2]);
  });

  it("rejects unsafe or excessive rich content before renderer mutation", () => {
    const fake = fakePlatform();
    const composition = createSvgTextComposition({ runtime: fake.runtime });
    const target = { drawableID: 12 };
    const invalidRuns: unknown[] = [
      "text",
      [{ type: "markup", text: "<svg/>" }],
      [{ type: "text", text: "safe", onclick: "alert(1)" }],
      [{ type: "ruby", base: "", reading: "から" }],
      [{ type: "ruby", base: "改\\n行", reading: "かいぎょう" }],
      [{ type: "ruby", base: "字", reading: "よ".repeat(513) }],
    ];

    for (const runs of invalidRuns) {
      expect(() =>
        composition.setRichText({
          styleName: "default",
          target,
          runs,
        } as never),
      ).toThrow();
    }
    expect(() =>
      composition.layoutRichText({
        styleName: "default",
        runs: [],
        nativeSize: [480, 360],
        maxWidth: 0,
      }),
    ).toThrow(/maxWidth/u);
    expect(() =>
      composition.layoutRichText({
        styleName: "default",
        runs: Array.from({ length: 1025 }, () => ({
          type: "text" as const,
          text: "a",
        })),
        nativeSize: [480, 360],
      }),
    ).toThrow(/1024 runs/u);
    expect(fake.created).toEqual([]);
  });

  it("rejects malformed host-neutral layout input before measuring", () => {
    const composition = createSvgTextLayoutComposition();
    const invalidSizes: unknown[] = [
      [480],
      [480, 360, 1],
      [0, 360],
      [480, Number.POSITIVE_INFINITY],
      ["480", 360],
    ];

    for (const nativeSize of invalidSizes) {
      expect(() =>
        composition.layoutText({
          styleName: "default",
          text: "text",
          nativeSize,
        } as never),
      ).toThrow(/nativeSize/u);
    }
    expect(() =>
      composition.layoutText({
        styleName: "missing",
        text: "text",
        nativeSize: [480, 360],
      }),
    ).toThrow(/not defined/u);
    expect(() =>
      composition.layoutText({
        styleName: "default",
        text: "text",
        nativeSize: [480, 360],
        markup: "<svg/>",
      } as never),
    ).toThrow(/unknown properties/u);
  });

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
