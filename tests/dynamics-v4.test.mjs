import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
test("V4 exposes dynamics and typhoon products",()=>{const h=read("web/index.html");for(const x of ["700 hPa 垂直速度","500 hPa 垂直速度","850 hPa 涡度","200 hPa 散度","台风专题"])assert.match(h,new RegExp(x));});
test("V4 dynamics use real pressure-level templates and derived wind diagnostics",()=>{const a=read("web/dynamics.mjs");for(const x of ["vertical_velocity_${level}hPa","wind_speed_${level}hPa","wind_direction_${level}hPa","omega(700)","omega(500)","windDiag(850,'vor')","windDiag(200,'div')"])assert.ok(a.includes(x),`missing ${x}`);for(const f of ["omega700","omega500","vorticity850","divergence200","typhoon","horizontalDerivatives"])assert.match(a,new RegExp(`function ${f}\\(`));assert.match(a,/JMA/);});
