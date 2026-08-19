import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");

test("V5 exposes moisture diagnostics and a two-point vertical section",()=>{
  const h=read("web/index.html");
  for(const x of ["850 hPa 水汽通量","850 hPa 水汽通量散度","垂直剖面","剖面起点","剖面终点"]) assert.match(h,new RegExp(x));
});

test("V5 derives moisture flux from real temperature RH pressure and wind fields",()=>{
  const a=read("web/moisture.mjs");
  for(const x of ["temperature_850hPa","relative_humidity_850hPa","wind_speed_850hPa","wind_direction_850hPa"]) assert.match(a,new RegExp(x));
  for(const f of ["specificHumidity","moistureFlux850","moistureFluxDivergence850","verticalSection"]) assert.match(a,new RegExp(`function ${f}\\(`));
  assert.match(a,/derived/i);
});

test("V5 vertical section requests multiple pressure levels along an interpolated transect",()=>{
  const a=read("web/moisture.mjs");
  for(const p of [1000,925,850,700,600,500,400,300,250,200]) assert.match(a,new RegExp(`temperature_${p}hPa`));
  assert.match(a,/sectionPoints/);
  assert.match(a,/Plotly\.react/);
});
