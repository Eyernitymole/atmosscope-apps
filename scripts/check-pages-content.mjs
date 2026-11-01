import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const entries = ["ordinary.html", "index.html"];

export function validatePagesContent(root) {
  const directory = resolve(root);
  const errors = [];
  for (const entry of entries) {
    const htmlPath = resolve(directory, entry);
    if (!existsSync(htmlPath) || !statSync(htmlPath).isFile()) {
      errors.push(`${entry}: missing entry`);
      continue;
    }
    const html = readFileSync(htmlPath, "utf8");
    for (const tag of html.matchAll(/<[a-z][^>]*>/gi)) {
      for (const match of tag[0].matchAll(/\s(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
        const value = (match[1] ?? match[2] ?? match[3]).trim();
        if (!value || value.startsWith("#") || value.startsWith("?")) continue;
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) continue;
        let path;
        try {
          path = decodeURIComponent(value.split(/[?#]/, 1)[0]);
        } catch {
          errors.push(`${entry}: invalid URL encoding: ${value}`);
          continue;
        }
        const target = resolve(directory, path);
        const within = relative(directory, target);
        if (path.startsWith("/") || path.includes("\\") || isAbsolute(path) || within === ".." || within.startsWith("../") || within.startsWith("..\\")) {
          errors.push(`${entry}: unsafe local reference: ${value}`);
        } else if (!existsSync(target) || !statSync(target).isFile()) {
          errors.push(`${entry}: missing local resource: ${value}`);
        }
      }
    }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validatePagesContent(process.argv[2] ?? "web");
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Pages entries and local references are present.");
  }
}
