import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("V3 professional atlas groups products by meteorological workflow", () => {
  const html = read("web/index.html");
  for (const group of ["实况监测","高空形势","降水预报","强对流诊断","模式探空","动力诊断"]) {
    assert.match(html, new RegExp(group));
  }
  for (const label of ["850 hPa 温度与风","850 hPa 相对湿度","700 hPa 相对湿度","海平面气压","500 hPa + 海平面气压","500 hPa + 850 hPa 温风","强对流诊断"]) {
    assert.match(html, new RegExp(label.replace(/[+]/g, "\\+")));
  }
});

test("V3 products request real model variables and have dedicated renderers", () => {
  const app = read("web/app.js");
  for (const variable of ["temperature_850hPa","relative_humidity_850hPa","relative_humidity_700hPa","pressure_msl","cape"]) {
    assert.match(app, new RegExp(variable));
  }
  for (const renderer of ["tempWind850","humidity850","humidity700","mslp","h500Mslp","h500T850Wind","convection"]) {
    assert.match(app, new RegExp(`function ${renderer}\\(`));
  }
});
