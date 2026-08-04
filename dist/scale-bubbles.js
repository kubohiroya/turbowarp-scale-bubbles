// Name: Scalable Bubbles
// ID: kubohiroyascalablebubbles
// Description: Responsive named-style say and think bubbles for TurboWarp.
// By: Hiroya Kubo
// License: MPL-2.0

(function (Scratch) {
  'use strict';

  //#region src/config.ts
  var extensionConfig = {
  	id: "kubohiroyascalablebubbles",
  	slug: "scale-bubbles",
  	name: "Scalable Bubbles",
  	description: "Responsive named-style say and think bubbles for TurboWarp.",
  	author: "Hiroya Kubo",
  	license: "MPL-2.0",
  	unsandboxed: true
  };
  var block_definitions_default = {
  	extensionName: "Scalable Bubbles",
  	blocks: [
  		{
  			"opcode": "defineStyle",
  			"blockType": "COMMAND",
  			"text": "define bubble style [STYLE] background [BACKGROUND] text [TEXT_COLOR] font [FONT] size [SIZE] align [ALIGN]",
  			"description": "Defines or replaces a named responsive bubble style.",
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
  		},
  		{
  			"opcode": "sayWithStyle",
  			"blockType": "COMMAND",
  			"text": "say [MESSAGE] with style [STYLE]",
  			"description": "Shows a responsive say bubble using a named style.",
  			"arguments": {
  				"MESSAGE": {
  					"type": "STRING",
  					"defaultValue": "Hello!\\nHow are you?"
  				},
  				"STYLE": {
  					"type": "STRING",
  					"defaultValue": "default"
  				}
  			}
  		},
  		{
  			"opcode": "thinkWithStyle",
  			"blockType": "COMMAND",
  			"text": "think [MESSAGE] with style [STYLE]",
  			"description": "Shows a responsive think bubble using a named style.",
  			"arguments": {
  				"MESSAGE": {
  					"type": "STRING",
  					"defaultValue": "Hmm...\\nI wonder."
  				},
  				"STYLE": {
  					"type": "STRING",
  					"defaultValue": "default"
  				}
  			}
  		},
  		{
  			"opcode": "say",
  			"blockType": "COMMAND",
  			"text": "say [MESSAGE] with font size [SIZE]",
  			"description": "Legacy size-based say bubble kept for saved-project compatibility.",
  			"hideFromPalette": true,
  			"arguments": {
  				"MESSAGE": {
  					"type": "STRING",
  					"defaultValue": "Hello!\\nHow are you?"
  				},
  				"SIZE": {
  					"type": "NUMBER",
  					"defaultValue": 100
  				}
  			}
  		},
  		{
  			"opcode": "think",
  			"blockType": "COMMAND",
  			"text": "think [MESSAGE] with font size [SIZE]",
  			"description": "Legacy size-based think bubble kept for saved-project compatibility.",
  			"hideFromPalette": true,
  			"arguments": {
  				"MESSAGE": {
  					"type": "STRING",
  					"defaultValue": "Hmm...\\nI wonder."
  				},
  				"SIZE": {
  					"type": "NUMBER",
  					"defaultValue": 100
  				}
  			}
  		}
  	],
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
  //#region src/extension.ts
  var blockDefinitions = block_definitions_default.blocks;
  var definitionMenus = block_definitions_default.menus;
  var EXTENSION_DOCS_URI = "https://kubohiroya.github.io/turbowarp-scale-bubbles/";
  var bubbleStateKey = "Scratch.looks";
  var defaultStyleName = "default";
  var defaultFontPercent = 100;
  var minimumFontPercent = 1;
  var maximumFontPercent = 1e3;
  var maximumFontNameLength = 128;
  var baseStageWidth = 480;
  var baseStageHeight = 360;
  var baseStyle = {
  	maxLineWidth: 170,
  	minWidth: 50,
  	strokeWidth: 4,
  	padding: 10,
  	cornerRadius: 16,
  	tailHeight: 12,
  	fontSize: 14,
  	fontHeightRatio: .9,
  	lineHeight: 16
  };
  var initialDefaultStyle = {
  	alignment: "left",
  	backgroundColor: "#ffffff",
  	font: "Helvetica",
  	fontPercent: defaultFontPercent,
  	textColor: "#575e75"
  };
  var ScalableBubblesExtension = class {
  	constructor(runtime = Scratch.vm?.runtime) {
  		this.styles = /* @__PURE__ */ new Map([[defaultStyleName, initialDefaultStyle]]);
  		this.activeStyles = /* @__PURE__ */ new WeakMap();
  		this.pendingStyles = /* @__PURE__ */ new WeakMap();
  		this.alignedSkins = /* @__PURE__ */ new WeakSet();
  		if (!runtime) throw new Error("Scalable Bubbles requires the TurboWarp VM.");
  		this.runtime = runtime;
  		this.handleSayOrThink = this.handleSayOrThink.bind(this);
  		this.handleStageSizeChanged = this.handleStageSizeChanged.bind(this);
  		this.runtime.on("SAY", this.handleSayOrThink);
  		this.runtime.on("STAGE_SIZE_CHANGED", this.handleStageSizeChanged);
  	}
  	getInfo() {
  		return {
  			id: extensionConfig.id,
  			name: Scratch.translate(block_definitions_default.extensionName),
  			docsURI: EXTENSION_DOCS_URI,
  			color1: "#9966ff",
  			blocks: blockDefinitions.map((block) => this.toScratchBlock(block)),
  			menus: definitionMenus
  		};
  	}
  	defineStyle(args) {
  		const styleName = this.normalizeStyleName(args.STYLE);
  		const definition = {
  			alignment: this.normalizeAlignment(args.ALIGN),
  			backgroundColor: this.normalizeColor(args.BACKGROUND, initialDefaultStyle.backgroundColor),
  			font: this.normalizeFont(args.FONT),
  			fontPercent: this.normalizeFontPercent(args.SIZE),
  			textColor: this.normalizeColor(args.TEXT_COLOR, initialDefaultStyle.textColor)
  		};
  		this.styles.set(styleName, definition);
  		this.restyleVisibleBubbles(styleName, definition);
  	}
  	sayWithStyle(args, util) {
  		this.showStyledBubble("say", args, util);
  	}
  	thinkWithStyle(args, util) {
  		this.showStyledBubble("think", args, util);
  	}
  	say(args, util) {
  		this.showLegacyBubble("say", args, util);
  	}
  	think(args, util) {
  		this.showLegacyBubble("think", args, util);
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
  		return Scratch.Cast.toString(value).trim() || defaultStyleName;
  	}
  	normalizeFontPercent(value) {
  		if (typeof value === "string" && value.trim() === "") return defaultFontPercent;
  		const numericValue = Number(value);
  		if (!Number.isFinite(numericValue)) return defaultFontPercent;
  		return Math.min(maximumFontPercent, Math.max(minimumFontPercent, numericValue));
  	}
  	normalizeMessage(value) {
  		return Scratch.Cast.toString(value).replace(/\\r\\n|\\n|\\r/gu, "\n");
  	}
  	normalizeAlignment(value) {
  		const alignment = Scratch.Cast.toString(value).trim().toLowerCase();
  		if (alignment === "center" || alignment === "right") return alignment;
  		return "left";
  	}
  	normalizeColor(value, fallback) {
  		const color = Scratch.Cast.toString(value).trim();
  		if (color === "") return fallback;
  		if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/iu.test(color)) return color;
  		if (globalThis.CSS?.supports?.("color", color)) return color;
  		return fallback;
  	}
  	normalizeFont(value) {
  		const font = Scratch.Cast.toString(value).trim();
  		const hasUnsafeCharacter = [...font].some((character) => {
  			const codePoint = character.codePointAt(0) ?? 0;
  			return codePoint <= 31 || codePoint === 127 || ",;{}".includes(character);
  		});
  		if (font === "" || font.length > maximumFontNameLength || hasUnsafeCharacter) return initialDefaultStyle.font;
  		return font;
  	}
  	getStageScale() {
  		const nativeSize = this.runtime.renderer?.getNativeSize?.();
  		if (!Array.isArray(nativeSize) || nativeSize.length < 2) return 1;
  		const width = Number(nativeSize[0]);
  		const height = Number(nativeSize[1]);
  		if (!(width > 0) || !(height > 0)) return 1;
  		return Math.min(width / baseStageWidth, height / baseStageHeight);
  	}
  	createRenderStyle(definition) {
  		const stageScale = this.getStageScale();
  		const fontScale = stageScale * (definition.fontPercent / defaultFontPercent);
  		return {
  			maxLineWidth: baseStyle.maxLineWidth * stageScale,
  			minWidth: baseStyle.minWidth * stageScale,
  			strokeWidth: baseStyle.strokeWidth * stageScale,
  			padding: baseStyle.padding * stageScale,
  			cornerRadius: baseStyle.cornerRadius * stageScale,
  			tailHeight: baseStyle.tailHeight * stageScale,
  			font: definition.font,
  			fontSize: baseStyle.fontSize * fontScale,
  			fontHeightRatio: baseStyle.fontHeightRatio,
  			lineHeight: baseStyle.lineHeight * fontScale,
  			bubbleFill: definition.backgroundColor,
  			textFill: definition.textColor,
  			textAlign: definition.alignment
  		};
  	}
  	resolveStyle(value) {
  		const requestedName = this.normalizeStyleName(value);
  		const definition = this.styles.get(requestedName);
  		if (definition) return {
  			definition,
  			styleName: requestedName
  		};
  		return {
  			definition: this.styles.get(defaultStyleName) ?? initialDefaultStyle,
  			styleName: defaultStyleName
  		};
  	}
  	getBubbleState(target) {
  		const state = target.getCustomState?.(bubbleStateKey);
  		if (!state || typeof state !== "object") return null;
  		return state;
  	}
  	getTextBubbleSkin(skinId) {
  		const skins = this.runtime.renderer?._allSkins;
  		if (!skins) return null;
  		return (skins instanceof Map ? skins.get(skinId) : skins[skinId]) ?? null;
  	}
  	installAlignmentRenderer(skin) {
  		if (this.alignedSkins.has(skin)) return;
  		const originalRender = skin._renderTextBubble;
  		if (typeof originalRender !== "function") return;
  		skin._renderTextBubble = function renderAlignedTextBubble(scale) {
  			const style = this._style;
  			const alignment = style?.textAlign;
  			const textFill = style?.textFill;
  			if (!style || alignment !== "center" && alignment !== "right" || typeof textFill !== "string") {
  				originalRender.call(this, scale);
  				return;
  			}
  			style.textFill = "transparent";
  			try {
  				originalRender.call(this, scale);
  			} finally {
  				style.textFill = textFill;
  			}
  			const context = this._canvas?.getContext("2d");
  			const lines = this._lines;
  			const width = this._textAreaSize?.width;
  			const padding = style.padding;
  			const lineHeight = style.lineHeight;
  			const fontHeightRatio = style.fontHeightRatio;
  			const fontSize = style.fontSize;
  			if (!context || !lines || typeof width !== "number" || typeof padding !== "number" || typeof lineHeight !== "number" || typeof fontHeightRatio !== "number" || typeof fontSize !== "number") return;
  			context.save();
  			context.fillStyle = textFill;
  			context.textAlign = alignment;
  			const x = alignment === "center" ? width / 2 : width - padding;
  			for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
  				const line = lines[lineNumber];
  				if (line === void 0) continue;
  				context.fillText(line, x, padding + lineHeight * lineNumber + fontHeightRatio * fontSize);
  			}
  			context.restore();
  		};
  		this.alignedSkins.add(skin);
  	}
  	applyBubbleStyle(target, type, text, selection) {
  		const bubbleState = this.getBubbleState(target);
  		if (!bubbleState || typeof bubbleState.skinId !== "number") return;
  		const normalizedText = this.normalizeMessage(text);
  		if (bubbleState.text !== normalizedText) {
  			bubbleState.text = normalizedText;
  			this.runtime.renderer?.updateTextSkin?.(bubbleState.skinId, type, normalizedText, bubbleState.onSpriteRight, [0, 0]);
  		}
  		const skin = this.getTextBubbleSkin(bubbleState.skinId);
  		if (typeof skin?.setStyle !== "function") return;
  		this.installAlignmentRenderer(skin);
  		skin.setStyle(this.createRenderStyle(selection.definition));
  		target.onTargetVisualChange?.(target);
  		this.runtime.requestRedraw?.();
  	}
  	handleSayOrThink(target, type, text) {
  		const selection = this.pendingStyles.get(target) ?? this.resolveStyle(defaultStyleName);
  		this.pendingStyles.delete(target);
  		const normalizedText = this.normalizeMessage(this.getBubbleState(target)?.text ?? text);
  		if (normalizedText === "") {
  			this.activeStyles.delete(target);
  			return;
  		}
  		this.activeStyles.set(target, selection);
  		this.applyBubbleStyle(target, type, normalizedText, selection);
  	}
  	handleStageSizeChanged() {
  		for (const target of this.runtime.targets ?? []) {
  			const bubbleState = this.getBubbleState(target);
  			if (!bubbleState?.text) continue;
  			const selection = this.activeStyles.get(target) ?? this.resolveStyle(defaultStyleName);
  			this.applyBubbleStyle(target, bubbleState.type, bubbleState.text, selection);
  		}
  	}
  	restyleVisibleBubbles(styleName, definition) {
  		for (const target of this.runtime.targets ?? []) {
  			const selection = this.activeStyles.get(target);
  			const bubbleState = this.getBubbleState(target);
  			if (selection?.styleName !== styleName || !bubbleState?.text) continue;
  			const nextSelection = {
  				definition,
  				styleName
  			};
  			this.activeStyles.set(target, nextSelection);
  			this.applyBubbleStyle(target, bubbleState.type, bubbleState.text, nextSelection);
  		}
  	}
  	showStyledBubble(type, args, util) {
  		this.showBubble(type, args.MESSAGE, this.resolveStyle(args.STYLE), util);
  	}
  	showLegacyBubble(type, args, util) {
  		const defaultDefinition = this.styles.get(defaultStyleName) ?? initialDefaultStyle;
  		this.showBubble(type, args.MESSAGE, {
  			definition: {
  				...defaultDefinition,
  				fontPercent: this.normalizeFontPercent(args.SIZE)
  			},
  			styleName: null
  		}, util);
  	}
  	showBubble(type, messageValue, selection, util) {
  		const message = this.normalizeMessage(messageValue);
  		this.pendingStyles.set(util.target, selection);
  		try {
  			this.runtime.emit("SAY", util.target, type, message);
  		} finally {
  			this.pendingStyles.delete(util.target);
  		}
  	}
  };
  //#endregion
  //#region src/index.ts
  if (extensionConfig.unsandboxed && !Scratch.extensions.unsandboxed) throw new Error(`${extensionConfig.name} must run unsandboxed.`);
  Scratch.extensions.register(new ScalableBubblesExtension());
  //#endregion

})(Scratch);
