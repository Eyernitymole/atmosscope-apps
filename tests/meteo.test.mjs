import assert from 'node:assert/strict';
import test from 'node:test';
import{bilinear,contourSegments,kIndex,lclPressure,skewX,windBarbParts}from'../web/meteo.mjs';
test('wind barb parts round wind speed to standard 5-knot increments',()=>{assert.deepEqual(windBarbParts(27),{knots:50,flags:1,full:0,half:0});assert.deepEqual(windBarbParts(15),{knots:30,flags:0,full:3,half:0});assert.deepEqual(windBarbParts(2.6),{knots:5,flags:0,full:0,half:1})});
test('LCL pressure is plausible for warm humid surface air',()=>{const p=lclPressure(30,20,1000);assert.ok(p>840&&p<900)});
test('K index follows pressure-level definition',()=>assert.equal(kIndex({t850:20,t700:5,t500:-10,td850:15,td700:0}),40));
test('Skew-T transform skews temperatures aloft',()=>{assert.equal(skewX(10,1000),10);assert.ok(skewX(10,500)>20)});
test('bilinear center is mean of a 2x2 grid',()=>assert.equal(bilinear(0,10,20,30,.5,.5),15));
test('marching squares finds a vertical contour',()=>{const s=contourSegments([[0,1],[0,1]],[20,30],[100,110],.5);assert.equal(s.length,1);assert.ok(Math.abs(s[0][0][1]-105)<1e-9);assert.ok(Math.abs(s[0][1][1]-105)<1e-9)});
