// Name: SVG Text
// ID: kubohiroyasvgtext
// Description: Responsive named-style SVG text actors for TurboWarp.
// By: Hiroya Kubo
// License: MPL-2.0

(function (Scratch) {
  'use strict';

  //#region src/config.ts
  var extensionConfig = {
  	id: "kubohiroyasvgtext",
  	slug: "svg-text",
  	name: "SVG Text",
  	description: "Responsive named-style SVG text actors for TurboWarp.",
  	author: "Hiroya Kubo",
  	license: "MPL-2.0",
  	unsandboxed: true
  };
  var block_definitions_default = {
  	extensionName: "SVG Text",
  	blocks: [{
  		"opcode": "defineStyle",
  		"blockType": "COMMAND",
  		"text": "define text style [STYLE] background [BACKGROUND] text [TEXT_COLOR] font [FONT] size [SIZE] align [ALIGN]",
  		"description": "Defines or replaces a named text style for SVG text actors. Bubble shape and placement are owned by the host Bubble layer.",
  		"arguments": {
  			"STYLE": {
  				"type": "STRING",
  				"defaultValue": "default"
  			},
  			"BACKGROUND": {
  				"type": "COLOR",
  				"defaultValue": "#ffffff"
  			},
  			"TEXT_COLOR": {
  				"type": "COLOR",
  				"defaultValue": "#575e75"
  			},
  			"FONT": {
  				"type": "STRING",
  				"defaultValue": "Helvetica"
  			},
  			"SIZE": {
  				"type": "NUMBER",
  				"defaultValue": 100
  			},
  			"ALIGN": {
  				"type": "STRING",
  				"defaultValue": "left",
  				"menu": "alignment"
  			}
  		}
  	}, {
  		"opcode": "setText",
  		"blockType": "COMMAND",
  		"text": "set this sprite text [TEXT] with style [STYLE]",
  		"description": "Replaces this sprite's skin with responsive styled SVG text.",
  		"arguments": {
  			"TEXT": {
  				"type": "STRING",
  				"defaultValue": "Title\\nSubtitle"
  			},
  			"STYLE": {
  				"type": "STRING",
  				"defaultValue": "default"
  			}
  		}
  	}],
  	menus: { "alignment": {
  		"acceptReporters": true,
  		"items": [
  			"left",
  			"center",
  			"right"
  		]
  	} }
  };
  //#endregion
  //#region src/text-layout.ts
  var baseStageWidth = 480;
  var baseStageHeight = 360;
  var defaultFontPercent$1 = 100;
  var defaultRubyFontPercent$1 = 50;
  var defaultRubyGap$1 = 1;
  var maximumFontNameLength = 128;
  var textStyle = {
  	fontSize: 14,
  	lineHeight: 16,
  	padding: 12,
  	cornerRadius: 8
  };
  var DEFAULT_SVG_TEXT_STYLE = Object.freeze({
  	alignment: "left",
  	backgroundColor: "#ffffff",
  	font: "Helvetica",
  	fontPercent: defaultFontPercent$1,
  	textColor: "#575e75"
  });
  var DEFAULT_SVG_TEXT_RICH_STYLE = Object.freeze({
  	...DEFAULT_SVG_TEXT_STYLE,
  	rubyFontPercent: defaultRubyFontPercent$1,
  	rubyGap: defaultRubyGap$1
  });
  function createSvgTextLayout(text, definition, nativeSize) {
  	const metrics = createTextMetrics(definition, nativeSize);
  	const lineMeasurements = text.split("\n").map((line) => ({
  		text: line,
  		width: measureTextWidth(line, metrics.fontSize)
  	}));
  	const contentWidth = Math.max(1, ...lineMeasurements.map((line) => line.width));
  	const width = Math.max(1, Math.ceil(contentWidth + metrics.padding * 2));
  	const height = Math.max(1, Math.ceil(metrics.lineHeight * lineMeasurements.length + metrics.padding * 2));
  	const x = definition.alignment === "center" ? width / 2 : definition.alignment === "right" ? width - metrics.padding : metrics.padding;
  	const lines = Object.freeze(lineMeasurements.map((line, index) => Object.freeze({
  		baseline: metrics.padding + metrics.fontSize + metrics.lineHeight * index,
  		text: line.text,
  		width: line.width,
  		x
  	})));
  	const style = createLayoutStyle(definition, metrics);
  	return Object.freeze({
  		height,
  		lines,
  		preserveWhitespace: true,
  		style,
  		width
  	});
  }
  function renderSvgTextLayout(layout) {
  	const textAnchor = layout.style.alignment === "center" ? "middle" : layout.style.alignment === "right" ? "end" : "start";
  	const text = layout.lines.map((line) => line.text).join("\n");
  	const tspans = layout.lines.map((line) => `<tspan x="${formatSvgNumber(line.x)}" y="${formatSvgNumber(line.baseline)}">${escapeXml(line.text)}</tspan>`).join("");
  	const whitespaceAttribute = layout.preserveWhitespace ? " xml:space=\"preserve\"" : "";
  	return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img"><title>${escapeXml(text)}</title><rect width="${layout.width}" height="${layout.height}" rx="${formatSvgNumber(layout.style.cornerRadius)}" fill="${escapeXml(layout.style.backgroundColor)}"/><text${whitespaceAttribute} fill="${escapeXml(layout.style.textColor)}" font-family="${escapeXml(layout.style.font)}" font-size="${formatSvgNumber(layout.style.fontSize)}" text-anchor="${textAnchor}">${tspans}</text></svg>`;
  }
  function normalizeSvgTextColor(value, fallback) {
  	const color = value.trim();
  	if (color === "") return fallback;
  	if (color.toLowerCase() === "transparent") return color;
  	if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/iu.test(color)) return color;
  	if (globalThis.CSS?.supports?.("color", color)) return color;
  	return fallback;
  }
  function normalizeSvgTextFont(value) {
  	const font = value.trim();
  	const hasUnsafeCharacter = [...font].some((character) => {
  		const codePoint = character.codePointAt(0) ?? 0;
  		return codePoint <= 31 || codePoint === 127 || ",;{}".includes(character);
  	});
  	if (font === "" || font.length > maximumFontNameLength || hasUnsafeCharacter) return DEFAULT_SVG_TEXT_STYLE.font;
  	return font;
  }
  function createTextMetrics(definition, nativeSize) {
  	const stageScale = Math.min(nativeSize[0] / baseStageWidth, nativeSize[1] / baseStageHeight);
  	const fontScale = stageScale * (definition.fontPercent / defaultFontPercent$1);
  	return {
  		cornerRadius: textStyle.cornerRadius * stageScale,
  		fontScale,
  		fontSize: textStyle.fontSize * fontScale,
  		lineHeight: textStyle.lineHeight * fontScale,
  		padding: textStyle.padding * stageScale
  	};
  }
  function createLayoutStyle(definition, metrics) {
  	return Object.freeze({
  		alignment: definition.alignment,
  		backgroundColor: definition.backgroundColor,
  		cornerRadius: metrics.cornerRadius,
  		font: definition.font,
  		fontPercent: definition.fontPercent,
  		fontSize: metrics.fontSize,
  		lineHeight: metrics.lineHeight,
  		padding: metrics.padding,
  		textColor: definition.textColor
  	});
  }
  function measureTextWidth(text, fontSize) {
  	let units = 0;
  	for (const character of text) {
  		if (/\p{Mark}/u.test(character)) continue;
  		if (/\s/u.test(character)) {
  			units += .35;
  			continue;
  		}
  		const codePoint = character.codePointAt(0) ?? 0;
  		units += codePoint <= 127 ? .62 : 1;
  	}
  	return units * fontSize;
  }
  function escapeXml(value) {
  	return value.replace(/[&<>"']/gu, (character) => {
  		switch (character) {
  			case "&": return "&amp;";
  			case "<": return "&lt;";
  			case ">": return "&gt;";
  			case "\"": return "&quot;";
  			default: return "&apos;";
  		}
  	});
  }
  function formatSvgNumber(value) {
  	return String(Math.round(value * 1e3) / 1e3);
  }
  //#endregion
  //#region src/extension.ts
  var blockDefinitions = block_definitions_default.blocks;
  var definitionMenus = block_definitions_default.menus;
  var EXTENSION_DOCS_URI = "https://kubohiroya.github.io/turbowarp-svg-text/";
  var defaultStyleName = "default";
  var defaultFontPercent = 100;
  var defaultRubyFontPercent = 50;
  var defaultRubyGap = 1;
  var minimumFontPercent = 1;
  var maximumFontPercent = 1e3;
  var minimumRubyFontPercent = 10;
  var maximumRubyFontPercent = 100;
  var minimumRubyGap = 0;
  var maximumRubyGap = 100;
  var BLOCK_ICON_URI = `data:image/svg+xml,${encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\"><g fill=\"none\" stroke=\"#fff\" stroke-width=\"5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M13 23V12h11M40 12h11v11M13 41v11h11M40 52h11V41M22 23h20M32 23v23\"/></g></svg>")}`;
  var SvgTextExtension = class {
  	constructor(runtime = Scratch.vm?.runtime, options = {}) {
  		this.styles = /* @__PURE__ */ new Map([[defaultStyleName, DEFAULT_SVG_TEXT_RICH_STYLE]]);
  		this.textActors = /* @__PURE__ */ new Map();
  		if (!runtime) throw new Error("SVG Text requires the TurboWarp VM.");
  		this.runtime = runtime;
  		this.castToString = options.castToString ?? Scratch.Cast.toString;
  		if (options.listenForRuntimeEvents ?? true) this.runtime.on("STAGE_SIZE_CHANGED", () => {
  			this.restyleTextActors();
  		});
  	}
  	getInfo() {
  		return {
  			id: extensionConfig.id,
  			name: Scratch.translate(block_definitions_default.extensionName),
  			docsURI: EXTENSION_DOCS_URI,
  			blockIconURI: BLOCK_ICON_URI,
  			color1: "#9966ff",
  			blocks: blockDefinitions.map((block) => this.toScratchBlock(block)),
  			menus: definitionMenus
  		};
  	}
  	defineStyle(args) {
  		const styleName = this.normalizeStyleName(args.STYLE);
  		this.styles.set(styleName, {
  			alignment: this.normalizeAlignment(args.ALIGN),
  			backgroundColor: this.normalizeColor(args.BACKGROUND, DEFAULT_SVG_TEXT_STYLE.backgroundColor),
  			font: this.normalizeFont(args.FONT),
  			fontPercent: this.normalizeFontPercent(args.SIZE),
  			rubyFontPercent: this.normalizeRubyFontPercent(args.RUBY_SIZE),
  			rubyGap: this.normalizeRubyGap(args.RUBY_GAP),
  			textColor: this.normalizeColor(args.TEXT_COLOR, DEFAULT_SVG_TEXT_STYLE.textColor)
  		});
  		this.restyleTextActors(styleName);
  	}
  	setText(args, util) {
  		this.applyTextActor(util.target, {
  			kind: "plain",
  			text: this.normalizeMessage(args.TEXT)
  		}, this.resolveStyle(args.STYLE));
  	}
  	measureText(styleName, text) {
  		const selection = this.resolveStyle(styleName);
  		const layout = createSvgTextLayout(this.normalizeMessage(text), selection.definition, this.getNativeSize());
  		return Math.max(0, ...layout.lines.map((line) => line.width));
  	}
  	setCompositionText(styleName, render, target) {
  		const content = Object.freeze({
  			kind: "composition",
  			render
  		});
  		this.applyTextActor(target, content, this.resolveStyle(styleName));
  	}
  	releaseTextActor(target) {
  		const state = this.textActors.get(target);
  		if (!state) return false;
  		this.textActors.delete(target);
  		this.runtime.renderer?.destroySkin?.(state.skinId);
  		this.runtime.requestRedraw?.();
  		return true;
  	}
  	toScratchBlock(block) {
  		return {
  			opcode: block.opcode,
  			blockType: Scratch.BlockType[block.blockType],
  			text: Scratch.translate(block.text),
  			hideFromPalette: block.hideFromPalette ?? false,
  			arguments: Object.fromEntries(Object.entries(block.arguments).map(([name, argument]) => [name, {
  				type: Scratch.ArgumentType[argument.type],
  				defaultValue: argument.defaultValue,
  				...argument.menu === void 0 ? {} : { menu: argument.menu }
  			}]))
  		};
  	}
  	normalizeStyleName(value) {
  		return this.castToString(value).trim() || defaultStyleName;
  	}
  	normalizeFontPercent(value) {
  		if (typeof value === "string" && value.trim() === "") return defaultFontPercent;
  		const numericValue = Number(value);
  		if (!Number.isFinite(numericValue)) return defaultFontPercent;
  		return Math.min(maximumFontPercent, Math.max(minimumFontPercent, numericValue));
  	}
  	normalizeRubyFontPercent(value) {
  		if (typeof value === "string" && value.trim() === "") return defaultRubyFontPercent;
  		const numericValue = Number(value);
  		if (!Number.isFinite(numericValue)) return defaultRubyFontPercent;
  		return Math.min(maximumRubyFontPercent, Math.max(minimumRubyFontPercent, numericValue));
  	}
  	normalizeRubyGap(value) {
  		if (typeof value === "string" && value.trim() === "") return defaultRubyGap;
  		const numericValue = Number(value);
  		if (!Number.isFinite(numericValue)) return defaultRubyGap;
  		return Math.min(maximumRubyGap, Math.max(minimumRubyGap, numericValue));
  	}
  	normalizeMessage(value) {
  		return this.castToString(value).replace(/\\r\\n|\\n|\\r/gu, "\n");
  	}
  	normalizeAlignment(value) {
  		const alignment = this.castToString(value).trim().toLowerCase();
  		if (alignment === "center" || alignment === "right") return alignment;
  		return "left";
  	}
  	normalizeColor(value, fallback) {
  		return normalizeSvgTextColor(this.castToString(value), fallback);
  	}
  	normalizeFont(value) {
  		return normalizeSvgTextFont(this.castToString(value));
  	}
  	getNativeSize() {
  		const nativeSize = this.runtime.renderer?.getNativeSize?.();
  		if (!Array.isArray(nativeSize) || nativeSize.length < 2) return [480, 360];
  		const width = Number(nativeSize[0]);
  		const height = Number(nativeSize[1]);
  		if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [480, 360];
  		return [width, height];
  	}
  	createTextActorSvg(content, definition) {
  		if (content.kind === "composition") return content.render(definition, this.getNativeSize());
  		return renderSvgTextLayout(createSvgTextLayout(content.text, definition, this.getNativeSize()));
  	}
  	applyTextActor(target, content, selection) {
  		const renderer = this.runtime.renderer;
  		if (typeof target.drawableID !== "number" || typeof renderer?.createSVGSkin !== "function" || typeof renderer.updateDrawableSkinId !== "function") throw new Error("SVG Text requires SVG skin APIs from TurboWarp.");
  		const skinId = renderer.createSVGSkin(this.createTextActorSvg(content, selection.definition));
  		if (!Number.isInteger(skinId) || skinId < 0) throw new Error("TurboWarp did not create an SVG text skin.");
  		try {
  			renderer.updateDrawableSkinId(target.drawableID, skinId);
  		} catch (error) {
  			renderer.destroySkin?.(skinId);
  			throw error;
  		}
  		const previous = this.textActors.get(target);
  		this.textActors.set(target, {
  			content,
  			skinId,
  			styleName: selection.styleName
  		});
  		if (previous && previous.skinId !== skinId) renderer.destroySkin?.(previous.skinId);
  		this.runtime.requestRedraw?.();
  	}
  	resolveStyle(value) {
  		const requestedName = this.normalizeStyleName(value);
  		const definition = this.styles.get(requestedName);
  		if (definition) return {
  			definition,
  			styleName: requestedName
  		};
  		return {
  			definition: this.styles.get(defaultStyleName) ?? DEFAULT_SVG_TEXT_RICH_STYLE,
  			styleName: defaultStyleName
  		};
  	}
  	restyleTextActors(styleName) {
  		for (const [target, state] of [...this.textActors]) {
  			if (styleName !== void 0 && state.styleName !== styleName) continue;
  			this.applyTextActor(target, state.content, this.resolveStyle(state.styleName));
  		}
  	}
  };
  //#endregion
  //#region src/index.ts
  if (extensionConfig.unsandboxed && !Scratch.extensions.unsandboxed) throw new Error(`${extensionConfig.name} must run unsandboxed.`);
  Scratch.extensions.register(new SvgTextExtension());
  //#endregion

})(Scratch);
