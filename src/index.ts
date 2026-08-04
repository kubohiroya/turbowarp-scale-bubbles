import { extensionConfig } from "./config.js";
import { SvgTextExtension } from "./extension.js";

if (extensionConfig.unsandboxed && !Scratch.extensions.unsandboxed) {
  throw new Error(`${extensionConfig.name} must run unsandboxed.`);
}

Scratch.extensions.register(new SvgTextExtension());
