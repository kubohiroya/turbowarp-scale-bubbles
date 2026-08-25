import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const errors = [];

const packageMetadata = JSON.parse(await readFile("package.json", "utf8"));
const policy = JSON.parse(await readFile("repo-policy.json", "utf8"));
const readme = await readFile("README.md", "utf8");
const changelog = await readFile("CHANGELOG.md", "utf8");
const license = await readFile("LICENSE", "utf8");
const config = await readFile("src/config.ts", "utf8");
const standaloneBundle = await readFile(
  policy.extension.standaloneBundle,
  "utf8",
);
const compositionBundle = await readFile(
  policy.extension.compositionBundle,
  "utf8",
);
const compositionTypes = await readFile(
  policy.extension.compositionTypes,
  "utf8",
);
const pages = [
  await readFile("docs/index.html", "utf8"),
  await readFile("docs/ja/index.html", "utf8"),
];

checkPolicy();
checkPackageMetadata();
checkReadme();
checkChangelog();
checkLicense();
checkBundleMetadata();
await checkPackContents();

if (errors.length > 0) {
  throw new Error(`Repository policy check failed:\n- ${errors.join("\n- ")}`);
}

process.stdout.write("Repository policy is aligned.\n");

function checkPolicy() {
  if (policy.schemaVersion !== 1)
    errors.push("repo-policy.json schemaVersion must be 1");
  if (policy.productName !== "TurboWarp-SVG-Text") {
    errors.push("repo-policy.json productName must be TurboWarp-SVG-Text");
  }
  if (policy.packageType !== "extension-composition") {
    errors.push("repo-policy.json packageType must be extension-composition");
  }
  if (policy.licensePolicy !== "mpl-2.0")
    errors.push("repo-policy.json licensePolicy must be mpl-2.0");
  if (policy.packageManager !== "pnpm")
    errors.push("repo-policy.json packageManager must be pnpm");
  if (policy.homepage !== "pages")
    errors.push(
      "repo-policy.json homepage must record Pages as the user entrypoint",
    );
  if (
    policy.integrations?.tmKamishibaiIssue !==
    "https://github.com/kubohiroya/tm-kamishibai/issues/636"
  ) {
    errors.push(
      "repo-policy.json must point to the current TM Kamishibai issue URL",
    );
  }
}

function checkPackageMetadata() {
  for (const key of [
    "description",
    "author",
    "license",
    "homepage",
    "packageManager",
  ]) {
    if (
      typeof packageMetadata[key] !== "string" ||
      packageMetadata[key].trim().length === 0
    ) {
      errors.push(`package.json ${key} must be a non-empty string`);
    }
  }
  if (packageMetadata.license !== "MPL-2.0")
    errors.push("package.json license must be MPL-2.0");
  if (
    packageMetadata.homepage !==
    "https://kubohiroya.github.io/turbowarp-svg-text/"
  ) {
    errors.push("package.json homepage must point to the Pages user guide");
  }
  if (!packageMetadata.packageManager.startsWith("pnpm@")) {
    errors.push("package.json packageManager must pin pnpm");
  }
  for (const file of ["dist/", "CHANGELOG.md", "README.md", "LICENSE"]) {
    if (!packageMetadata.files?.includes(file))
      errors.push(`package.json files must include ${file}`);
  }
}

function checkReadme() {
  if (!readme.startsWith(`# ${policy.productName}\n`)) {
    errors.push("README.md H1 must match repo-policy.json productName");
  }
  const installLine = `pnpm add --save-exact ${packageMetadata.name}@${packageMetadata.version}`;
  const cdnUrl = `https://cdn.jsdelivr.net/npm/${packageMetadata.name}@${packageMetadata.version}/dist/svg-text.js`;
  if (!readme.includes(installLine))
    errors.push("README.md install example must match package version");
  if (!readme.includes(cdnUrl))
    errors.push("README.md CDN URL must match package version");
  if (!readme.includes("TM Kamishibai"))
    errors.push("README.md must use TM Kamishibai naming");
  if (
    !readme.includes("https://github.com/kubohiroya/tm-kamishibai/issues/636")
  ) {
    errors.push("README.md must link to the current TM Kamishibai issue");
  }
  if (!readme.includes("SPDX-License-Identifier: MPL-2.0")) {
    errors.push("README.md License section must include the SPDX identifier");
  }
  for (const page of pages) {
    if (!page.includes(installLine) || !page.includes(cdnUrl)) {
      errors.push(
        "Pages guides must match package version install and CDN examples",
      );
    }
    if (
      !page.includes("TM Kamishibai") ||
      !page.includes("https://github.com/kubohiroya/tm-kamishibai/issues/636")
    ) {
      errors.push("Pages guides must use the current TM Kamishibai link");
    }
  }
}

function checkChangelog() {
  if (!changelog.includes(`## ${packageMetadata.version} `)) {
    errors.push(
      "CHANGELOG.md must contain the current package version section",
    );
  }
}

function checkLicense() {
  if (
    !license.startsWith(
      "Mozilla Public License Version 2.0\n==================================",
    )
  ) {
    errors.push(
      "LICENSE must contain the Mozilla Public License Version 2.0 full text",
    );
  }
  if (!license.includes("Exhibit A - Source Code Form License Notice")) {
    errors.push("LICENSE must include the MPL-2.0 Exhibit A text");
  }
}

function checkBundleMetadata() {
  if (!config.includes('license: "MPL-2.0"')) {
    errors.push("src/config.ts license metadata must be MPL-2.0");
  }
  if (!standaloneBundle.includes("// License: MPL-2.0")) {
    errors.push("dist/svg-text.js license metadata must be MPL-2.0");
  }
  if (!standaloneBundle.includes("// ID: kubohiroyasvgtext")) {
    errors.push("dist/svg-text.js must retain SVG Text extension ID");
  }
  if (!compositionBundle.includes("createSvgTextComposition")) {
    errors.push("dist/composition.js must retain the Composition API");
  }
  if (!compositionTypes.includes("createSvgTextComposition")) {
    errors.push(
      "dist/types/composition.d.ts must retain Composition API types",
    );
  }
  const legacyPoseNamePattern = new RegExp(
    [
      ["tm", "pose"].join(""),
      ["TM", "Pose"].join(""),
      ["TM", "POSE"].join(""),
    ].join("|"),
    "u",
  );
  if (legacyPoseNamePattern.test([readme, ...pages].join("\n"))) {
    errors.push("README and Pages must not retain legacy pose-era naming");
  }
}

async function checkPackContents() {
  const { stdout } = await execFileAsync("npm", [
    "pack",
    "--dry-run",
    "--ignore-scripts",
    "--json",
  ]);
  const [pack] = JSON.parse(stdout);
  const files = new Set(pack.files.map((file) => file.path));
  for (const file of [
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
    policy.extension.standaloneBundle,
    policy.extension.compositionBundle,
    policy.extension.compositionTypes,
  ]) {
    if (!files.has(file)) errors.push(`npm pack must include ${file}`);
  }
  if (pack.version !== packageMetadata.version) {
    errors.push("npm pack version must match package.json version");
  }
}
