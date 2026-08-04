// Name: Scalable Bubbles
// ID: kubohiroyascalablebubbles
// Description: Keep say and think bubbles proportional to the TurboWarp stage size.
// By: Hiroya Kubo
// License: MPL-2.0

(function (Scratch) {
  'use strict';

  //#region src/config.ts
  var extensionConfig = {
  	id: "kubohiroyascalablebubbles",
  	slug: "scale-bubbles",
  	name: "Scalable Bubbles",
  	description: "Keep say and think bubbles proportional to the TurboWarp stage size.",
  	author: "Hiroya Kubo",
  	license: "MPL-2.0",
  	unsandboxed: true
  };
  var block_definitions_default = {
  	extensionName: "Scalable Bubbles",
  	blocks: [{
  		"opcode": "say",
  		"blockType": "COMMAND",
  		"text": "say [MESSAGE] with font size [SIZE]",
  		"description": "Shows a responsive say bubble at the requested relative font size.",
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
  	}, {
  		"opcode": "think",
  		"blockType": "COMMAND",
  		"text": "think [MESSAGE] with font size [SIZE]",
  		"description": "Shows a responsive think bubble at the requested relative font size.",
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
  	}]
  };
  //#endregion
  //#region src/extension.ts
  var blockDefinitions = block_definitions_default.blocks;
  var EXTENSION_DOCS_URI = "https://kubohiroya.github.io/turbowarp-scale-bubbles/";
  var bubbleStateKey = "Scratch.looks";
  var defaultFontPercent = 100;
  var minimumFontPercent = 1;
  var maximumFontPercent = 1e3;
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
  	lineHeight: 16
  };
  var ScalableBubblesExtension = class {
  	constructor(runtime = Scratch.vm?.runtime) {
  		this.activeFontPercents = /* @__PURE__ */ new WeakMap();
  		this.pendingFontPercents = /* @__PURE__ */ new WeakMap();
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
  			blocks: blockDefinitions.map((block) => this.toScratchBlock(block))
  		};
  	}
  	say(args, util) {
  		this.showBubble("say", args, util);
  	}
  	think(args, util) {
  		this.showBubble("think", args, util);
  	}
  	toScratchBlock(block) {
  		return {
  			opcode: block.opcode,
  			blockType: Scratch.BlockType[block.blockType],
  			text: Scratch.translate(block.text),
  			arguments: Object.fromEntries(Object.entries(block.arguments).map(([name, argument]) => [name, {
  				type: Scratch.ArgumentType[argument.type],
  				defaultValue: argument.defaultValue
  			}]))
  		};
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
  	getStageScale() {
  		const nativeSize = this.runtime.renderer?.getNativeSize?.();
  		if (!Array.isArray(nativeSize) || nativeSize.length < 2) return 1;
  		const width = Number(nativeSize[0]);
  		const height = Number(nativeSize[1]);
  		if (!(width > 0) || !(height > 0)) return 1;
  		return Math.min(width / baseStageWidth, height / baseStageHeight);
  	}
  	createStyle(fontPercent) {
  		const stageScale = this.getStageScale();
  		const fontScale = stageScale * (fontPercent / defaultFontPercent);
  		return {
  			maxLineWidth: baseStyle.maxLineWidth * stageScale,
  			minWidth: baseStyle.minWidth * stageScale,
  			strokeWidth: baseStyle.strokeWidth * stageScale,
  			padding: baseStyle.padding * stageScale,
  			cornerRadius: baseStyle.cornerRadius * stageScale,
  			tailHeight: baseStyle.tailHeight * stageScale,
  			fontSize: baseStyle.fontSize * fontScale,
  			lineHeight: baseStyle.lineHeight * fontScale
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
  	applyBubbleStyle(target, type, text, fontPercent) {
  		const bubbleState = this.getBubbleState(target);
  		if (!bubbleState || typeof bubbleState.skinId !== "number") return;
  		const normalizedText = this.normalizeMessage(text);
  		if (bubbleState.text !== normalizedText) {
  			bubbleState.text = normalizedText;
  			this.runtime.renderer?.updateTextSkin?.(bubbleState.skinId, type, normalizedText, bubbleState.onSpriteRight, [0, 0]);
  		}
  		const skin = this.getTextBubbleSkin(bubbleState.skinId);
  		if (typeof skin?.setStyle !== "function") return;
  		skin.setStyle(this.createStyle(fontPercent));
  		target.onTargetVisualChange?.(target);
  		this.runtime.requestRedraw?.();
  	}
  	handleSayOrThink(target, type, text) {
  		const pendingFontPercent = this.pendingFontPercents.get(target);
  		this.pendingFontPercents.delete(target);
  		const fontPercent = pendingFontPercent ?? defaultFontPercent;
  		const normalizedText = this.normalizeMessage(this.getBubbleState(target)?.text ?? text);
  		if (normalizedText === "") {
  			this.activeFontPercents.delete(target);
  			return;
  		}
  		this.activeFontPercents.set(target, fontPercent);
  		this.applyBubbleStyle(target, type, normalizedText, fontPercent);
  	}
  	handleStageSizeChanged() {
  		for (const target of this.runtime.targets ?? []) {
  			const bubbleState = this.getBubbleState(target);
  			if (!bubbleState?.text) continue;
  			this.applyBubbleStyle(target, bubbleState.type, bubbleState.text, this.activeFontPercents.get(target) ?? defaultFontPercent);
  		}
  	}
  	showBubble(type, args, util) {
  		const fontPercent = this.normalizeFontPercent(args.SIZE);
  		const message = this.normalizeMessage(args.MESSAGE);
  		this.pendingFontPercents.set(util.target, fontPercent);
  		try {
  			this.runtime.emit("SAY", util.target, type, message);
  		} finally {
  			this.pendingFontPercents.delete(util.target);
  		}
  	}
  };
  //#endregion
  //#region src/index.ts
  if (extensionConfig.unsandboxed && !Scratch.extensions.unsandboxed) throw new Error(`${extensionConfig.name} must run unsandboxed.`);
  Scratch.extensions.register(new ScalableBubblesExtension());
  //#endregion

})(Scratch);
