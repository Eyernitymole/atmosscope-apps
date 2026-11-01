import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

const script = new URL("../scripts/check-pages-content.mjs", import.meta.url);
const implementation = await import(script.href).catch(() => ({}));

function site(t, ordinary, professional, assets = {}) {
  const root = mkdtempSync(join(tmpdir(), "atmosscope-pages-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  if (ordinary !== null) writeFileSync(join(root, "ordinary.html"), ordinary);
  if (professional !== null) writeFileSync(join(root, "index.html"), professional);
  for (const [path, content] of Object.entries(assets)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

test("accepts both entries with existing local assets and external references", (t) => {
  assert.equal(typeof implementation.validatePagesContent, "function");
  const root = site(t,
    '<link href="ordinary.css?v=2#theme"><script src="ordinary.mjs"></script><a href="index.html">图集</a>',
    '<link href="https://cdn.example.com/map.css"><script src="//cdn.example.com/map.js"></script><a href="ordinary.html">天气</a>',
    { "ordinary.css": "body {}", "ordinary.mjs": "" });
  assert.deepEqual(implementation.validatePagesContent(root), []);
});

test("reports a missing entry or local asset", (t) => {
  const root = site(t, '<script src="missing.mjs"></script>', null);
  const errors = implementation.validatePagesContent(root);
  assert.ok(errors.some((error) => error.includes("index.html")));
  assert.ok(errors.some((error) => error.includes("missing.mjs")));
});

test("rejects references escaping or rooted outside the published directory", (t) => {
  const root = site(t, '<script src="../secret.js"></script><link href="/global.css">', "<p>图集</p>");
  const errors = implementation.validatePagesContent(root);
  assert.ok(errors.some((error) => error.includes("../secret.js")));
  assert.ok(errors.some((error) => error.includes("/global.css")));
});

test("CLI exits nonzero with a clear missing-resource finding", (t) => {
  const root = site(t, '<script src="missing.mjs"></script>', "<p>图集</p>");
  assert.equal(existsSync(root), true);
  const run = spawnSync(process.execPath, [script.pathname, root], { encoding: "utf8" });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /missing\.mjs/);
});

test("unquoted resources are checked and data attributes are ignored", (t) => {
  const root = site(t, '<div data-src="not-an-asset"></div><script src=missing.mjs></script>', "<p>图集</p>");
  assert.deepEqual(implementation.validatePagesContent(root), ["ordinary.html: missing local resource: missing.mjs"]);
});

test("public weather entry keeps visible linked Open-Meteo and licence credit", () => {
  const html = readFileSync(new URL("../web/ordinary.html", import.meta.url), "utf8");
  const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i)?.[1] ?? "";
  assert.match(footer, /<a\s+href="https:\/\/open-meteo\.com\/"[^>]*>[^<]*Open-Meteo[^<]*<\/a>/);
  assert.match(footer, /<a\s+href="https:\/\/open-meteo\.com\/en\/licence"[^>]*>[^<]*CC BY 4\.0[^<]*<\/a>/);
});

test("public atlas keeps visible linked Open-Meteo, RainViewer and OSM credit", () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i)?.[1] ?? "";
  assert.match(footer, /<a\s+href="https:\/\/open-meteo\.com\/"[^>]*>[^<]*Open.Meteo[^<]*<\/a>/);
  assert.match(footer, /<a\s+href="https:\/\/open-meteo\.com\/en\/licence"[^>]*>[^<]*CC BY 4\.0[^<]*<\/a>/);
  assert.match(footer, /<a\s+href="https:\/\/www\.rainviewer\.com\/"[^>]*>[^<]*RainViewer[^<]*<\/a>/);
  assert.match(footer, /<a\s+href="https:\/\/www\.openstreetmap\.org\/copyright"[^>]*>[^<]*OpenStreetMap[^<]*<\/a>/);
});
