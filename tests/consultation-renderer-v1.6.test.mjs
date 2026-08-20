import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src=readFileSync(new URL("../web/consultation-renderer.mjs",import.meta.url),"utf8");

test("consultation renderer creates vector layer",()=>{
 assert.match(src,/renderMoistureVectorLayer/);
 assert.match(src,/layerGroup/);
 assert.match(src,/L\.marker/);
});

test("consultation legend describes all layers",()=>{
 assert.match(src,/500 hPa/);
 assert.match(src,/850 hPa/);
 assert.match(src,/累计降水/);
});
