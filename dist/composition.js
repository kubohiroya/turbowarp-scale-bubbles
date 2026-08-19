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
function createSvgTextRichLayout(runs, definition, nativeSize, maxWidth) {
	const metrics = createTextMetrics(definition, nativeSize);
	const rubyFontSize = metrics.fontSize * (definition.rubyFontPercent / defaultFontPercent$1);
	const rubyGap = definition.rubyGap * metrics.fontScale;
	const style = Object.freeze({
		...createLayoutStyle(definition, metrics),
		rubyFontPercent: definition.rubyFontPercent,
		rubyFontSize,
		rubyGap
	});
	const plainText = runs.map((run) => run.type === "ruby" ? run.base : run.text).join("");
	const readingText = runs.map((run) => run.type === "ruby" ? run.reading : run.text).join("");
	const revealUnits = [];
	const items = [];
	for (const [runIndex, run] of runs.entries()) {
		if (run.type === "ruby") {
			const reveal = Object.freeze({
				end: run.base.length,
				index: revealUnits.length,
				runIndex,
				start: 0,
				type: "ruby"
			});
			revealUnits.push(reveal);
			const baseWidth = measureTextWidth(run.base, metrics.fontSize);
			const readingWidth = measureTextWidth(run.reading, rubyFontSize);
			items.push({
				base: run.base,
				baseWidth,
				reading: run.reading,
				readingWidth,
				reveal,
				type: "ruby",
				width: Math.max(baseWidth, readingWidth)
			});
			continue;
		}
		for (const grapheme of segmentGraphemes(run.text)) {
			if (grapheme.segment === "\n") {
				items.push("break");
				continue;
			}
			const reveal = Object.freeze({
				end: grapheme.end,
				index: revealUnits.length,
				runIndex,
				start: grapheme.start,
				type: "text"
			});
			revealUnits.push(reveal);
			items.push({
				reveal,
				text: grapheme.segment,
				type: "text",
				width: measureTextWidth(grapheme.segment, metrics.fontSize)
			});
		}
	}
	const contentLimit = maxWidth === void 0 ? void 0 : Math.max(1, maxWidth - metrics.padding * 2);
	const pendingLines = [];
	let pendingLine = {
		units: [],
		width: 0
	};
	const finishLine = () => {
		pendingLines.push(pendingLine);
		pendingLine = {
			units: [],
			width: 0
		};
	};
	for (const item of items) {
		if (item === "break") {
			finishLine();
			continue;
		}
		if (contentLimit !== void 0 && pendingLine.units.length > 0 && pendingLine.width + item.width > contentLimit) finishLine();
		pendingLine.units.push(item);
		pendingLine.width += item.width;
	}
	finishLine();
	const naturalWidth = Math.max(1, ...pendingLines.map((line) => line.width)) + metrics.padding * 2;
	const width = Math.max(1, Math.ceil(maxWidth === void 0 ? naturalWidth : Math.max(maxWidth, naturalWidth)));
	const baseDescent = Math.max(0, metrics.lineHeight - metrics.fontSize);
	let lineTop = metrics.padding;
	const lines = Object.freeze(pendingLines.map((pending) => {
		const hasRuby = pending.units.some((unit) => unit.type === "ruby");
		const ascent = metrics.fontSize + (hasRuby ? rubyFontSize + rubyGap : 0);
		const descent = baseDescent;
		const height = ascent + descent;
		const baseline = lineTop + ascent;
		const x = definition.alignment === "center" ? (width - pending.width) / 2 : definition.alignment === "right" ? width - metrics.padding - pending.width : metrics.padding;
		let fragmentX = x;
		const fragments = Object.freeze(pending.units.map((unit) => {
			if (unit.type === "text") {
				const fragment = Object.freeze({
					baseline,
					revealIndex: unit.reveal.index,
					text: unit.text,
					type: "text",
					width: unit.width,
					x: fragmentX
				});
				fragmentX += unit.width;
				return fragment;
			}
			const groupX = fragmentX;
			const base = Object.freeze({
				baseline,
				fontSize: metrics.fontSize,
				text: unit.base,
				width: unit.baseWidth,
				x: groupX + (unit.width - unit.baseWidth) / 2
			});
			const reading = Object.freeze({
				baseline: baseline - metrics.fontSize - rubyGap,
				fontSize: rubyFontSize,
				text: unit.reading,
				width: unit.readingWidth,
				x: groupX + (unit.width - unit.readingWidth) / 2
			});
			const fragment = Object.freeze({
				base,
				reading,
				revealIndex: unit.reveal.index,
				type: "ruby",
				width: unit.width,
				x: groupX
			});
			fragmentX += unit.width;
			return fragment;
		}));
		const line = Object.freeze({
			ascent,
			baseline,
			descent,
			fragments,
			height,
			overflow: contentLimit !== void 0 && pending.width > contentLimit,
			width: pending.width,
			x
		});
		lineTop += height;
		return line;
	}));
	const height = Math.max(1, Math.ceil(lineTop + metrics.padding));
	const overflow = lines.some((line) => line.overflow);
	return Object.freeze({
		height,
		lines,
		overflow,
		plainText,
		preserveWhitespace: true,
		readingText,
		revealUnits: Object.freeze(revealUnits),
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
function renderSvgTextRichLayout(layout) {
	const tspans = layout.lines.flatMap((line) => line.fragments.flatMap((fragment) => {
		if (fragment.type === "text") return [`<tspan x="${formatSvgNumber(fragment.x)}" y="${formatSvgNumber(fragment.baseline)}" font-size="${formatSvgNumber(layout.style.fontSize)}">${escapeXml(fragment.text)}</tspan>`];
		return [`<tspan x="${formatSvgNumber(fragment.reading.x)}" y="${formatSvgNumber(fragment.reading.baseline)}" font-size="${formatSvgNumber(fragment.reading.fontSize)}">${escapeXml(fragment.reading.text)}</tspan>`, `<tspan x="${formatSvgNumber(fragment.base.x)}" y="${formatSvgNumber(fragment.base.baseline)}" font-size="${formatSvgNumber(fragment.base.fontSize)}">${escapeXml(fragment.base.text)}</tspan>`];
	})).join("");
	const whitespaceAttribute = layout.preserveWhitespace ? " xml:space=\"preserve\"" : "";
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img"><title>${escapeXml(layout.plainText)}</title><rect width="${layout.width}" height="${layout.height}" rx="${formatSvgNumber(layout.style.cornerRadius)}" fill="${escapeXml(layout.style.backgroundColor)}"/><text${whitespaceAttribute} fill="${escapeXml(layout.style.textColor)}" font-family="${escapeXml(layout.style.font)}" text-anchor="start">${tspans}</text></svg>`;
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
function segmentGraphemes(value) {
	const segments = [];
	let current = "";
	let currentStart = 0;
	let joinNext = false;
	let offset = 0;
	for (const character of value) {
		if (!(current !== "" && (joinNext || character === "‍" || isGraphemeExtender(character))) && current !== "") {
			segments.push({
				end: offset,
				segment: current,
				start: currentStart
			});
			current = "";
		}
		if (current === "") currentStart = offset;
		current += character;
		joinNext = character === "‍";
		offset += character.length;
	}
	if (current !== "") segments.push({
		end: offset,
		segment: current,
		start: currentStart
	});
	return segments;
}
function isGraphemeExtender(character) {
	if (/\p{Mark}/u.test(character)) return true;
	const codePoint = character.codePointAt(0) ?? 0;
	return codePoint >= 65024 && codePoint <= 65039 || codePoint >= 917760 && codePoint <= 917999 || codePoint >= 127995 && codePoint <= 127999;
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
var defaultStyleName$1 = "default";
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
		this.styles = /* @__PURE__ */ new Map([[defaultStyleName$1, DEFAULT_SVG_TEXT_RICH_STYLE]]);
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
	/**
	* Exposes the stock named-style registry through a skin-free layout contract.
	* Consumers receive current layout data without access to the mutable registry.
	*/
	getLayoutCapability() {
		this.layoutCapabilityValue ??= Object.freeze({ layoutText: (input) => {
			if (typeof input !== "object" || input === null || typeof input.styleName !== "string" || typeof input.text !== "string") throw new TypeError("SVG Text layout capability input is invalid.");
			const nativeSize = this.requireLayoutNativeSize(input.nativeSize);
			const selection = this.resolveStyle(input.styleName);
			return createSvgTextLayout(this.normalizeMessage(input.text), selection.definition, nativeSize);
		} });
		return this.layoutCapabilityValue;
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
		return this.castToString(value).trim() || defaultStyleName$1;
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
	requireLayoutNativeSize(value) {
		if (!Array.isArray(value) || value.length !== 2 || value.some((dimension) => typeof dimension !== "number" || !Number.isFinite(dimension) || dimension <= 0)) throw new TypeError("SVG Text layout capability nativeSize must contain two positive finite numbers.");
		return value;
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
			definition: this.styles.get(defaultStyleName$1) ?? DEFAULT_SVG_TEXT_RICH_STYLE,
			styleName: defaultStyleName$1
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
//#region src/composition.ts
var defaultStyleName = "default";
var maximumContentCharacters = 1e5;
var maximumContentLines = 1e3;
var maximumContentRuns = 1024;
var maximumLayoutFragments = 1e4;
var maximumLayoutWidth = 1e5;
var maximumRubyBaseCharacters = 256;
var maximumRubyReadingCharacters = 512;
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function compositionError(code, message) {
	const error = new Error(message);
	Object.defineProperty(error, "code", { value: code });
	return error;
}
function requireExactKeys(value, required, optional, label) {
	const allowed = /* @__PURE__ */ new Set([...required, ...optional]);
	if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key)) || Object.keys(value).some((key) => !allowed.has(key))) throw compositionError("SVG-TEXT-COMPOSITION-001", `${label} has missing or unknown properties.`);
}
function requireName(value, label) {
	if (typeof value !== "string" || value.trim().length === 0) throw compositionError("SVG-TEXT-COMPOSITION-001", `${label} must be a non-empty string.`);
	return value.trim();
}
function validateRuntime(value) {
	if (!isRecord(value) || !isRecord(value.renderer)) throw new TypeError("SVG Text composition runtime must provide a renderer.");
	const renderer = value.renderer;
	const methods = [
		"createSVGSkin",
		"destroySkin",
		"updateDrawableSkinId"
	];
	if (methods.some((method) => typeof renderer[method] !== "function")) throw new TypeError(`SVG Text composition renderer must provide ${methods.join(", ")}.`);
	if (value.requestRedraw !== void 0 && typeof value.requestRedraw !== "function") throw new TypeError("SVG Text composition requestRedraw must be a function.");
	return value;
}
function validateTarget(value) {
	if (!isRecord(value) || typeof value.drawableID !== "number" || !Number.isInteger(value.drawableID) || value.drawableID < 0) throw compositionError("SVG-TEXT-COMPOSITION-002", "SVG Text target must provide a non-negative integer drawableID.");
	return value;
}
function validateOptionalString(value, label) {
	if (value !== void 0 && (typeof value !== "string" || value.length === 0)) throw compositionError("SVG-TEXT-COMPOSITION-001", `${label} must be a non-empty string when provided.`);
}
function validateStyle(value) {
	if (!isRecord(value)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text style must be an object.");
	requireExactKeys(value, ["name"], [
		"alignment",
		"backgroundColor",
		"font",
		"fontPercent",
		"rubyFontPercent",
		"rubyGap",
		"textColor"
	], "SVG Text style");
	const name = requireName(value.name, "SVG Text style name");
	if (value.alignment !== void 0 && value.alignment !== "left" && value.alignment !== "center" && value.alignment !== "right") throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text alignment is invalid.");
	validateOptionalString(value.backgroundColor, "SVG Text backgroundColor");
	validateOptionalString(value.font, "SVG Text font");
	validateOptionalString(value.textColor, "SVG Text textColor");
	if (value.fontPercent !== void 0 && (typeof value.fontPercent !== "number" || !Number.isFinite(value.fontPercent) || value.fontPercent < 1 || value.fontPercent > 1e3)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text fontPercent must be a finite number from 1 to 1000.");
	if (value.rubyFontPercent !== void 0 && (typeof value.rubyFontPercent !== "number" || !Number.isFinite(value.rubyFontPercent) || value.rubyFontPercent < 10 || value.rubyFontPercent > 100)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text rubyFontPercent must be a finite number from 10 to 100.");
	if (value.rubyGap !== void 0 && (typeof value.rubyGap !== "number" || !Number.isFinite(value.rubyGap) || value.rubyGap < 0 || value.rubyGap > 100)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text rubyGap must be a finite number from 0 to 100.");
	return {
		...value,
		name
	};
}
function createStyleDefinition(style) {
	return Object.freeze({
		alignment: style.alignment ?? DEFAULT_SVG_TEXT_STYLE.alignment,
		backgroundColor: normalizeSvgTextColor(style.backgroundColor ?? "", DEFAULT_SVG_TEXT_STYLE.backgroundColor),
		font: normalizeSvgTextFont(style.font ?? ""),
		fontPercent: style.fontPercent ?? DEFAULT_SVG_TEXT_STYLE.fontPercent,
		rubyFontPercent: style.rubyFontPercent ?? DEFAULT_SVG_TEXT_RICH_STYLE.rubyFontPercent,
		rubyGap: style.rubyGap ?? DEFAULT_SVG_TEXT_RICH_STYLE.rubyGap,
		textColor: normalizeSvgTextColor(style.textColor ?? "", DEFAULT_SVG_TEXT_STYLE.textColor)
	});
}
function validateNativeSize(value) {
	if (!Array.isArray(value) || value.length !== 2 || value.some((dimension) => typeof dimension !== "number" || !Number.isFinite(dimension) || dimension <= 0)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text nativeSize must be [width, height] with two positive finite numbers.");
	return value;
}
function getRuntimeNativeSize(renderer) {
	const value = renderer.getNativeSize?.();
	if (!Array.isArray(value) || value.length < 2) return [480, 360];
	const width = Number(value[0]);
	const height = Number(value[1]);
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [480, 360];
	return [width, height];
}
function normalizeText(value) {
	return value.replace(/\\r\\n|\\n|\\r/gu, "\n");
}
function normalizeRichText(value) {
	return normalizeText(value.replace(/\r\n?|\n/gu, "\n"));
}
function contentLimitError(message) {
	return compositionError("SVG-TEXT-COMPOSITION-007", message);
}
function validateContentRuns(value) {
	if (!Array.isArray(value)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text rich content runs must be an array.");
	if (value.length > maximumContentRuns) throw contentLimitError(`SVG Text rich content exceeds ${maximumContentRuns} runs.`);
	let characterCount = 0;
	let fragmentCount = 0;
	let lineCount = 1;
	const runs = value.map((candidate, runIndex) => {
		if (!isRecord(candidate)) throw compositionError("SVG-TEXT-COMPOSITION-001", `SVG Text rich content run ${runIndex} must be an object.`);
		if (candidate.type === "text") {
			requireExactKeys(candidate, ["type", "text"], [], `SVG Text rich content run ${runIndex}`);
			if (typeof candidate.text !== "string") throw compositionError("SVG-TEXT-COMPOSITION-001", `SVG Text rich content run ${runIndex} text must be a string.`);
			const text = normalizeRichText(candidate.text);
			characterCount += text.length;
			lineCount += text.split("\n").length - 1;
			fragmentCount += [...text.replace(/\n/gu, "")].length;
			return Object.freeze({
				text,
				type: "text"
			});
		}
		if (candidate.type === "ruby") {
			requireExactKeys(candidate, [
				"type",
				"base",
				"reading"
			], [], `SVG Text rich content run ${runIndex}`);
			if (typeof candidate.base !== "string" || typeof candidate.reading !== "string") throw compositionError("SVG-TEXT-COMPOSITION-001", `SVG Text rich content run ${runIndex} ruby base and reading must be strings.`);
			const base = normalizeRichText(candidate.base);
			const reading = normalizeRichText(candidate.reading);
			if (base.length === 0 || reading.length === 0 || base.includes("\n") || reading.includes("\n")) throw compositionError("SVG-TEXT-COMPOSITION-001", `SVG Text rich content run ${runIndex} ruby base and reading must be non-empty single-line strings.`);
			if (base.length > maximumRubyBaseCharacters) throw contentLimitError(`SVG Text ruby base exceeds ${maximumRubyBaseCharacters} characters.`);
			if (reading.length > maximumRubyReadingCharacters) throw contentLimitError(`SVG Text ruby reading exceeds ${maximumRubyReadingCharacters} characters.`);
			characterCount += base.length + reading.length;
			fragmentCount += 1;
			return Object.freeze({
				base,
				reading,
				type: "ruby"
			});
		}
		throw compositionError("SVG-TEXT-COMPOSITION-001", `SVG Text rich content run ${runIndex} type is invalid.`);
	});
	if (characterCount > maximumContentCharacters) throw contentLimitError(`SVG Text rich content exceeds ${maximumContentCharacters} characters.`);
	if (lineCount > maximumContentLines) throw contentLimitError(`SVG Text rich content exceeds ${maximumContentLines} lines.`);
	if (fragmentCount > maximumLayoutFragments) throw contentLimitError(`SVG Text rich content exceeds ${maximumLayoutFragments} layout fragments.`);
	return Object.freeze(runs);
}
function validateMaxWidth(value) {
	if (value === void 0) return void 0;
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > maximumLayoutWidth) throw compositionError("SVG-TEXT-COMPOSITION-001", `SVG Text maxWidth must be a finite number greater than 0 and no greater than ${maximumLayoutWidth}.`);
	return value;
}
function layoutTextFromStyles(styles, input) {
	if (!isRecord(input)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text layout input is invalid.");
	requireExactKeys(input, [
		"styleName",
		"text",
		"nativeSize"
	], [], "SVG Text layout input");
	const styleName = requireName(input.styleName, "SVG Text styleName");
	const definition = styles.get(styleName);
	if (!definition) throw compositionError("SVG-TEXT-COMPOSITION-003", `SVG Text style is not defined: ${styleName}`);
	if (typeof input.text !== "string") throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text text must be a string.");
	return createSvgTextLayout(normalizeText(input.text), definition, validateNativeSize(input.nativeSize));
}
function layoutRichTextFromStyles(styles, input) {
	if (!isRecord(input)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text rich layout input is invalid.");
	requireExactKeys(input, [
		"styleName",
		"runs",
		"nativeSize"
	], ["maxWidth"], "SVG Text rich layout input");
	const styleName = requireName(input.styleName, "SVG Text styleName");
	const definition = styles.get(styleName);
	if (!definition) throw compositionError("SVG-TEXT-COMPOSITION-003", `SVG Text style is not defined: ${styleName}`);
	const runs = validateContentRuns(input.runs);
	const nativeSize = validateNativeSize(input.nativeSize);
	const maxWidth = validateMaxWidth(input.maxWidth);
	return maxWidth === void 0 ? createSvgTextRichLayout(runs, definition, nativeSize) : createSvgTextRichLayout(runs, definition, nativeSize, maxWidth);
}
function createSvgTextLayoutComposition() {
	const styles = /* @__PURE__ */ new Map([[defaultStyleName, DEFAULT_SVG_TEXT_RICH_STYLE]]);
	return Object.freeze({
		defineStyle(input) {
			const style = validateStyle(input);
			styles.set(style.name, createStyleDefinition(style));
		},
		layoutRichText(input) {
			return layoutRichTextFromStyles(styles, input);
		},
		layoutText(input) {
			return layoutTextFromStyles(styles, input);
		}
	});
}
function createSvgTextComposition(options) {
	if (!isRecord(options)) throw new TypeError("SVG Text composition options must be an object.");
	const runtime = validateRuntime(options.runtime);
	const extension = new SvgTextExtension(runtime, {
		castToString: (value) => String(value),
		listenForRuntimeEvents: false
	});
	const styles = /* @__PURE__ */ new Map([[defaultStyleName, DEFAULT_SVG_TEXT_RICH_STYLE]]);
	const targets = /* @__PURE__ */ new Set();
	let disposed = false;
	function ensureActive() {
		if (disposed) throw compositionError("SVG-TEXT-COMPOSITION-004", "SVG Text composition has been released.");
	}
	return Object.freeze({
		defineStyle(input) {
			ensureActive();
			const style = validateStyle(input);
			extension.defineStyle({
				ALIGN: style.alignment ?? "",
				BACKGROUND: style.backgroundColor ?? "",
				FONT: style.font ?? "",
				RUBY_GAP: style.rubyGap ?? "",
				RUBY_SIZE: style.rubyFontPercent ?? "",
				SIZE: style.fontPercent ?? "",
				STYLE: style.name,
				TEXT_COLOR: style.textColor ?? ""
			});
			styles.set(style.name, createStyleDefinition(style));
		},
		layoutRichText(input) {
			ensureActive();
			return layoutRichTextFromStyles(styles, input);
		},
		layoutText(input) {
			ensureActive();
			return layoutTextFromStyles(styles, input);
		},
		measureText(input) {
			ensureActive();
			if (!isRecord(input)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text measure input is invalid.");
			requireExactKeys(input, ["styleName", "text"], [], "SVG Text measure input");
			const styleName = requireName(input.styleName, "SVG Text styleName");
			if (!styles.has(styleName)) throw compositionError("SVG-TEXT-COMPOSITION-003", `SVG Text style is not defined: ${styleName}`);
			if (typeof input.text !== "string") throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text text must be a string.");
			return extension.measureText(styleName, input.text);
		},
		measureRichText(input) {
			ensureActive();
			if (!isRecord(input)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text rich measure input is invalid.");
			requireExactKeys(input, ["styleName", "runs"], ["maxWidth"], "SVG Text rich measure input");
			const styleName = requireName(input.styleName, "SVG Text styleName");
			const definition = styles.get(styleName);
			if (!definition) throw compositionError("SVG-TEXT-COMPOSITION-003", `SVG Text style is not defined: ${styleName}`);
			const runs = validateContentRuns(input.runs);
			const maxWidth = validateMaxWidth(input.maxWidth);
			const nativeSize = getRuntimeNativeSize(runtime.renderer);
			const layout = maxWidth === void 0 ? createSvgTextRichLayout(runs, definition, nativeSize) : createSvgTextRichLayout(runs, definition, nativeSize, maxWidth);
			return Math.max(0, ...layout.lines.map((line) => line.width));
		},
		setRichText(input) {
			ensureActive();
			if (!isRecord(input)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text rich actor input is invalid.");
			requireExactKeys(input, [
				"styleName",
				"target",
				"runs"
			], ["maxWidth"], "SVG Text rich actor input");
			const target = validateTarget(input.target);
			const styleName = requireName(input.styleName, "SVG Text styleName");
			if (!styles.has(styleName)) throw compositionError("SVG-TEXT-COMPOSITION-003", `SVG Text style is not defined: ${styleName}`);
			const runs = validateContentRuns(input.runs);
			const maxWidth = validateMaxWidth(input.maxWidth);
			extension.setCompositionText(styleName, (definition, nativeSize) => {
				return renderSvgTextRichLayout(maxWidth === void 0 ? createSvgTextRichLayout(runs, definition, nativeSize) : createSvgTextRichLayout(runs, definition, nativeSize, maxWidth));
			}, target);
			targets.add(target);
		},
		setText(input) {
			ensureActive();
			if (!isRecord(input)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text actor input is invalid.");
			requireExactKeys(input, [
				"styleName",
				"target",
				"text"
			], [], "SVG Text actor input");
			const target = validateTarget(input.target);
			const styleName = requireName(input.styleName, "SVG Text styleName");
			if (!styles.has(styleName)) throw compositionError("SVG-TEXT-COMPOSITION-003", `SVG Text style is not defined: ${styleName}`);
			if (typeof input.text !== "string") throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text text must be a string.");
			extension.setText({
				STYLE: styleName,
				TEXT: input.text
			}, { target });
			targets.add(target);
		},
		releaseTarget(value) {
			ensureActive();
			const target = validateTarget(value);
			if (!targets.delete(target)) throw compositionError("SVG-TEXT-COMPOSITION-005", "SVG Text target is not owned by this composition.");
			if (!extension.releaseTextActor(target)) throw compositionError("SVG-TEXT-COMPOSITION-005", "SVG Text target ownership is inconsistent.");
		},
		releaseAll() {
			if (disposed) return;
			disposed = true;
			const errors = [];
			for (const target of targets) try {
				extension.releaseTextActor(target);
			} catch (error) {
				errors.push(error);
			}
			targets.clear();
			styles.clear();
			if (errors.length > 0) {
				const error = compositionError("SVG-TEXT-COMPOSITION-006", "SVG Text composition failed to release one or more skins.");
				Object.defineProperty(error, "errors", { value: Object.freeze([...errors]) });
				throw error;
			}
		}
	});
}
//#endregion
export { createSvgTextComposition, createSvgTextLayoutComposition };
