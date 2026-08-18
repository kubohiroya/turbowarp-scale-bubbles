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
function createSvgTextLayout(text, definition, nativeSize) {
	const stageScale = Math.min(nativeSize[0] / baseStageWidth, nativeSize[1] / baseStageHeight);
	const fontScale = stageScale * (definition.fontPercent / defaultFontPercent$1);
	const fontSize = textStyle.fontSize * fontScale;
	const lineHeight = textStyle.lineHeight * fontScale;
	const padding = textStyle.padding * stageScale;
	const cornerRadius = textStyle.cornerRadius * stageScale;
	const lineMeasurements = text.split("\n").map((line) => ({
		text: line,
		width: measureTextWidth(line, fontSize)
	}));
	const contentWidth = Math.max(1, ...lineMeasurements.map((line) => line.width));
	const width = Math.max(1, Math.ceil(contentWidth + padding * 2));
	const height = Math.max(1, Math.ceil(lineHeight * lineMeasurements.length + padding * 2));
	const x = definition.alignment === "center" ? width / 2 : definition.alignment === "right" ? width - padding : padding;
	const lines = Object.freeze(lineMeasurements.map((line, index) => Object.freeze({
		baseline: padding + fontSize + lineHeight * index,
		text: line.text,
		width: line.width,
		x
	})));
	const style = Object.freeze({
		alignment: definition.alignment,
		backgroundColor: definition.backgroundColor,
		cornerRadius,
		font: definition.font,
		fontPercent: definition.fontPercent,
		fontSize,
		lineHeight,
		padding,
		textColor: definition.textColor
	});
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
var minimumFontPercent = 1;
var maximumFontPercent = 1e3;
var BLOCK_ICON_URI = `data:image/svg+xml,${encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\"><g fill=\"none\" stroke=\"#fff\" stroke-width=\"5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M13 23V12h11M40 12h11v11M13 41v11h11M40 52h11V41M22 23h20M32 23v23\"/></g></svg>")}`;
var SvgTextExtension = class {
	constructor(runtime = Scratch.vm?.runtime, options = {}) {
		this.styles = /* @__PURE__ */ new Map([[defaultStyleName$1, DEFAULT_SVG_TEXT_STYLE]]);
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
			textColor: this.normalizeColor(args.TEXT_COLOR, DEFAULT_SVG_TEXT_STYLE.textColor)
		});
		this.restyleTextActors(styleName);
	}
	setText(args, util) {
		this.applyTextActor(util.target, this.normalizeMessage(args.TEXT), this.resolveStyle(args.STYLE));
	}
	measureText(styleName, text) {
		const selection = this.resolveStyle(styleName);
		const layout = createSvgTextLayout(this.normalizeMessage(text), selection.definition, this.getNativeSize());
		return Math.max(0, ...layout.lines.map((line) => line.width));
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
	createTextActorSvg(text, definition) {
		return renderSvgTextLayout(createSvgTextLayout(text, definition, this.getNativeSize()));
	}
	applyTextActor(target, text, selection) {
		const renderer = this.runtime.renderer;
		if (typeof target.drawableID !== "number" || typeof renderer?.createSVGSkin !== "function" || typeof renderer.updateDrawableSkinId !== "function") throw new Error("SVG Text requires SVG skin APIs from TurboWarp.");
		const skinId = renderer.createSVGSkin(this.createTextActorSvg(text, selection.definition));
		if (!Number.isInteger(skinId) || skinId < 0) throw new Error("TurboWarp did not create an SVG text skin.");
		try {
			renderer.updateDrawableSkinId(target.drawableID, skinId);
		} catch (error) {
			renderer.destroySkin?.(skinId);
			throw error;
		}
		const previous = this.textActors.get(target);
		this.textActors.set(target, {
			skinId,
			styleName: selection.styleName,
			text
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
			definition: this.styles.get(defaultStyleName$1) ?? DEFAULT_SVG_TEXT_STYLE,
			styleName: defaultStyleName$1
		};
	}
	restyleTextActors(styleName) {
		for (const [target, state] of [...this.textActors]) {
			if (styleName !== void 0 && state.styleName !== styleName) continue;
			this.applyTextActor(target, state.text, this.resolveStyle(state.styleName));
		}
	}
};
//#endregion
//#region src/composition.ts
var defaultStyleName = "default";
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
		"textColor"
	], "SVG Text style");
	const name = requireName(value.name, "SVG Text style name");
	if (value.alignment !== void 0 && value.alignment !== "left" && value.alignment !== "center" && value.alignment !== "right") throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text alignment is invalid.");
	validateOptionalString(value.backgroundColor, "SVG Text backgroundColor");
	validateOptionalString(value.font, "SVG Text font");
	validateOptionalString(value.textColor, "SVG Text textColor");
	if (value.fontPercent !== void 0 && (typeof value.fontPercent !== "number" || !Number.isFinite(value.fontPercent) || value.fontPercent < 1 || value.fontPercent > 1e3)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text fontPercent must be a finite number from 1 to 1000.");
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
		textColor: normalizeSvgTextColor(style.textColor ?? "", DEFAULT_SVG_TEXT_STYLE.textColor)
	});
}
function validateNativeSize(value) {
	if (!Array.isArray(value) || value.length !== 2 || value.some((dimension) => typeof dimension !== "number" || !Number.isFinite(dimension) || dimension <= 0)) throw compositionError("SVG-TEXT-COMPOSITION-001", "SVG Text nativeSize must be [width, height] with two positive finite numbers.");
	return value;
}
function normalizeText(value) {
	return value.replace(/\\r\\n|\\n|\\r/gu, "\n");
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
function createSvgTextLayoutComposition() {
	const styles = /* @__PURE__ */ new Map([[defaultStyleName, DEFAULT_SVG_TEXT_STYLE]]);
	return Object.freeze({
		defineStyle(input) {
			const style = validateStyle(input);
			styles.set(style.name, createStyleDefinition(style));
		},
		layoutText(input) {
			return layoutTextFromStyles(styles, input);
		}
	});
}
function createSvgTextComposition(options) {
	if (!isRecord(options)) throw new TypeError("SVG Text composition options must be an object.");
	const extension = new SvgTextExtension(validateRuntime(options.runtime), {
		castToString: (value) => String(value),
		listenForRuntimeEvents: false
	});
	const styles = /* @__PURE__ */ new Map([[defaultStyleName, DEFAULT_SVG_TEXT_STYLE]]);
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
				SIZE: style.fontPercent ?? "",
				STYLE: style.name,
				TEXT_COLOR: style.textColor ?? ""
			});
			styles.set(style.name, createStyleDefinition(style));
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
