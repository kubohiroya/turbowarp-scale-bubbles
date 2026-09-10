import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const siteRoot = fileURLToPath(new URL("../docs/", import.meta.url));
const htmlFiles = await collectHtml(siteRoot);
const errors: string[] = [];

for (const htmlFile of htmlFiles) {
  const source = await readFile(htmlFile, "utf8");
  const ids = new Set(
    [...source.matchAll(/\bid="([^"]+)"/g)].flatMap((match) => match[1] ?? []),
  );
  const references = [...source.matchAll(/\b(?:href|src)="([^"]+)"/g)].flatMap(
    (match) => match[1] ?? [],
  );

  for (const reference of references) {
    if (/^(?:https?:|mailto:|data:)/.test(reference)) continue;

    const [pathname, fragment] = reference.split("#", 2);
    let target = pathname
      ? path.resolve(path.dirname(htmlFile), pathname)
      : htmlFile;
    if (await isDirectory(target)) target = path.join(target, "index.html");

    if (!(await exists(target))) {
      errors.push(`${relative(htmlFile)}: missing local target ${reference}`);
      continue;
    }

    if (fragment) {
      const targetSource =
        target === htmlFile ? source : await readFile(target, "utf8");
      const targetIds =
        target === htmlFile
          ? ids
          : new Set(
              [...targetSource.matchAll(/\bid="([^"]+)"/g)].map(
                (match) => match[1],
              ),
            );
      if (!targetIds.has(fragment)) {
        errors.push(
          `${relative(htmlFile)}: missing anchor #${fragment} in ${relative(target)}`,
        );
      }
    }
  }

  for (const figure of source.matchAll(
    /<figure\b([^>]*)>([\s\S]*?)<\/figure>/g,
  )) {
    const describedBy = figure[1]?.match(/\baria-describedby="([^"]+)"/)?.[1];
    if (!describedBy || !figure[2]?.includes(`id="${describedBy}"`)) {
      errors.push(
        `${relative(htmlFile)}: diagram is missing an in-figure text description`,
      );
    }
  }
}

if (errors.length > 0) {
  throw new Error(`Documentation site check failed:\n- ${errors.join("\n- ")}`);
}

process.stdout.write(
  `Checked ${htmlFiles.length} HTML pages and their local links, anchors, and diagram descriptions.\n`,
);

async function collectHtml(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectHtml(entryPath);
      return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

async function exists(target: string) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(target: string) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

function relative(target: string) {
  return path.relative(siteRoot, target) || "index.html";
}
