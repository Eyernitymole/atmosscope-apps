import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");

test("V1.6 exposes a synoptic consultation composite product",()=>{
  const h=read("web/index.html");
  assert.match(h,/综合会商/);
  assert.match(h,/data-moisture="consultationComposite"/);
});

test("moisture flux renders sparse vector arrows from derived q wind components",()=>{
  const a=read("web/moisture.mjs");
  assert.match(a,/function addMoistureVectors\(/);
  assert.match(a,/moisture-vector-arrow/);
  assert.match(a,/addMoistureVectors\(f\.qu,f\.qv/);
});

test("consultation composite combines 500 hPa height 850 hPa moisture transport and trailing precipitation",()=>{
  const a=read("web/moisture.mjs");
  assert.match(a,/function trailingPrecipitation\(/);
  assert.match(a,/geopotential_height_500hPa/);
  assert.match(a,/precipitation/);
  assert.match(a,/function addHeightContours\(/);
  assert.match(a,/async function consultationComposite\(/);
  assert.match(a,/采样网格/);
  assert.match(a,/derived/i);
});
