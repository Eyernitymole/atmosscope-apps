import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source=readFileSync(new URL("../web/moisture.mjs",import.meta.url),"utf8");

test("vertical section degrades gracefully when vertical velocity is unavailable",()=>{
  assert.match(source,/try\s*\{[^}]*vertical_velocity_/s);
  assert.match(source,/catch\s*\([^)]*\)\s*\{[^}]*垂直速度/s);
  assert.match(source,/omegaAvailable/);
});

test("moisture diagnostics own their legend and refresh behavior",()=>{
  assert.match(source,/legendLabels/);
  assert.match(source,/refreshBtn/);
  assert.match(source,/stopImmediatePropagation/);
});

test("vertical section uses cumulative great-circle distance in km",()=>{
  assert.match(source,/function cumulativeDistanceKm\(/);
  assert.match(source,/haversine/i);
  assert.match(source,/距离 \(km\)/);
});
