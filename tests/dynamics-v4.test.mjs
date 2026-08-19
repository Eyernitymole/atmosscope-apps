import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("V4 exposes dynamics and typhoon products", () => {
  const html = read("web/index.html");
  for (const label of ["700 hPa 垂直速度","500 hPa 垂直速度","850 hPa 涡度","200 hPa 散度","台风专题"]) assert.match(html,new RegExp(label));
});

test("V4 dynamics use pressure-level vertical velocity and wind derivatives", () => {
  const app = read("web/app.js");
  for (const variable of ["vertical_velocity_700hPa","vertical_velocity_500hPa","wind_speed_850hPa","wind_direction_850hPa","wind_speed_200hPa","wind_direction_200hPa"]) assert.match(app,new RegExp(variable));
  for (const renderer of ["omega700","omega500","vorticity850","divergence200","typhoon"]) assert.match(app,new RegExp(`function ${renderer}\\(`));
  assert.match(app,/horizontalDerivatives/);
});
