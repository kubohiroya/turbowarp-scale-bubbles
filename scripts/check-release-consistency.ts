import { readFile } from "node:fs/promises";
import process from "node:process";

const packageMetadata = JSON.parse(await readFile("package.json", "utf8"));
const version = packageMetadata.version;
const pinnedPackage = `@kubohiroya/turbowarp-svg-text@${version}`;
const errors: string[] = [];

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  errors.push(`package.json contains an invalid version: ${version}`);
}

for (const path of ["README.md", "docs/index.html", "docs/ja/index.html"]) {
  const source = await readFile(path, "utf8");
  const occurrences = source.split(pinnedPackage).length - 1;
  if (occurrences < 2) {
    errors.push(
      `${path} must contain version-pinned install and CDN examples for ${pinnedPackage}`,
    );
  }
}

if (process.env.GITHUB_REF_TYPE === "tag") {
  const expectedTag = `v${version}`;
  if (process.env.GITHUB_REF_NAME !== expectedTag) {
    errors.push(
      `release tag ${process.env.GITHUB_REF_NAME ?? "<missing>"} must equal ${expectedTag}`,
    );
  }
}

if (errors.length > 0) {
  throw new Error(
    `Release consistency check failed:\n- ${errors.join("\n- ")}`,
  );
}

process.stdout.write(`Release metadata is aligned with ${version}.\n`);
