import { describe, expect, it } from "vitest";
import schema from "../schemas/extension-manifest.schema.json";
import definitions from "../src/block-definitions.json";
import { extensionConfig } from "../src/config.js";
import {
  createExtensionManifest,
  EXTENSION_MANIFEST_FORMAT_VERSION,
  serializeExtensionManifest,
} from "../src/extension-manifest.js";

describe("extension API manifest", () => {
  it("serializes the public block contract deterministically", () => {
    const manifest = createExtensionManifest(extensionConfig.id, definitions);
    expect(manifest).toEqual({
      formatVersion: 1,
      id: "kubohiroyascalablebubbles",
      blocks: [
        {
          opcode: "say",
          blockType: "COMMAND",
          arguments: [
            { id: "MESSAGE", type: "STRING" },
            { id: "SIZE", type: "NUMBER" },
          ],
        },
        {
          opcode: "think",
          blockType: "COMMAND",
          arguments: [
            { id: "MESSAGE", type: "STRING" },
            { id: "SIZE", type: "NUMBER" },
          ],
        },
      ],
      menus: [],
    });
    expect(serializeExtensionManifest(extensionConfig.id, definitions)).toBe(
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  });

  it("keeps the schema format version aligned with the generator", () => {
    expect(schema.properties.formatVersion.const).toBe(
      EXTENSION_MANIFEST_FORMAT_VERSION,
    );
  });

  it("rejects duplicate opcodes", () => {
    expect(() =>
      createExtensionManifest("fixtureextension", {
        blocks: [
          { opcode: "same", blockType: "COMMAND" },
          { opcode: "same", blockType: "REPORTER" },
        ],
      }),
    ).toThrow("Duplicate block opcode: same");
  });
});
