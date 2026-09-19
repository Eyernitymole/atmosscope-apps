import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as renderer from '../web/consultation-renderer.mjs';

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

test('height contours follow true 60 m levels and skip invalid cells',()=>{
  const polylines=[];
  const L={layerGroup:()=>({addTo(){return this}}),
    polyline:(points,options)=>({addTo(group){polylines.push({points,options,group});return this}})};
  const field=[[5500,5600],[5500,5600]];
  const layer=renderer.renderHeightContourLayer({},field,[20,25],[100,105],L);
  assert.equal(polylines.length,2);
  assert.ok(polylines.every(item=>item.group===layer));
  assert.ok(polylines.every(item=>item.options.className==='height-contour-line'));
  assert.deepEqual(polylines.map(item=>item.points),[
    [[20,101],[25,101]],[[20,104],[25,104]]
  ]);
  polylines.length=0;
  renderer.renderHeightContourLayer({},[[5500,NaN],[5500,5600]],
    [20,25],[100,105],L);
  assert.equal(polylines.length,0);
});
