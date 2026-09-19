import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConsultationData } from '../web/consultation-data.mjs';

const hourly = () => ({
  time: Array.from({length:73},(_,i)=>new Date(Date.UTC(2026,8,19,i)).toISOString()),
  geopotential_height_500hPa:Array(73).fill(5580),
  temperature_850hPa:Array(73).fill(18),
  relative_humidity_850hPa:Array(73).fill(75),
  wind_speed_850hPa:Array(73).fill(8),
  wind_direction_850hPa:Array(73).fill(270),
  precipitation:Array(73).fill(0)
});
const sample=()=>Array.from({length:6},()=>({hourly:hourly()}));
const sum24=(h,i)=>h.precipitation.slice(i,i+24).reduce((a,b)=>a+b,0);
const build=(res,index=0,accumulate=sum24)=>
  buildConsultationData(res,[20,25],[100,105,110],index,accumulate);

test('dry zero is valid while a null hour removes only its point',()=>{
  const res=sample();
  res[5].hourly.precipitation[3]=null;
  const out=build(res);
  assert.equal(out.status,'ready');
  assert.deepEqual(out.coverage,{valid:5,total:6});
  assert.equal(out.grid.rain24[0][0],0);
  assert.ok(Number.isNaN(out.grid.rain24[1][2]));
  assert.ok(Number.isNaN(out.grid.height500[1][2]));
});

test('incomplete 24-hour horizon and wrong point count are insufficient',()=>{
  const res=sample();
  assert.match(build(res,51).reason,/24 小时/);
  assert.equal(build(res.slice(1)).status,'insufficient');
  assert.equal(build(res,48).status,'ready');
});

test('mismatched time and isolated valid points cannot make a composite',()=>{
  const res=sample();
  res[1].hourly.time[0]='2026-09-22T00:00:00.000Z';
  assert.equal(build(res).status,'insufficient');
  res[1].hourly.time[0]=res[0].hourly.time[0];
  res[1].hourly.precipitation[0]=null;
  res[4].hourly.precipitation[0]=null;
  assert.equal(build(res).status,'insufficient');
});

test('24 aligned hourly timestamps are required at every point',()=>{
  const res=sample();
  res[2].hourly.time[8]='2026-09-19T11:00:00.000Z';
  assert.equal(build(res).status,'insufficient');
});

test('provider GMT timestamps without an explicit offset are accepted as UTC',()=>{
  const res=sample();
  for(const point of res)point.hourly.time=point.hourly.time.map(t=>t.slice(0,16));
  const out=build(res);
  assert.equal(out.status,'ready');
  assert.equal(out.time.start,'2026-09-19T00:00:00.000Z');
  assert.equal(out.time.end,'2026-09-20T00:00:00.000Z');
});

test('negative precipitation invalidates that point, not a valid zero nearby',()=>{
  const res=sample();
  res[5].hourly.precipitation[0]=-1;
  const out=build(res);
  assert.equal(out.status,'ready');
  assert.equal(out.coverage.valid,5);
  assert.ok(Number.isNaN(out.grid.rain24[1][2]));
});

test('an entirely missing required field reports its name',()=>{
  const res=sample();
  for(const point of res)delete point.hourly.wind_direction_850hPa;
  const out=build(res);
  assert.equal(out.status,'insufficient');
  assert.ok(out.missing.includes('wind_direction_850hPa'));
});

test('the precipitation accumulator never sees a point with a missing hour',()=>{
  const res=sample();
  res[5].hourly.precipitation[7]=null;
  const seen=[];
  const out=build(res,0,(h,i)=>{seen.push(h);return sum24(h,i)});
  assert.equal(out.status,'ready');
  assert.equal(seen.length,5);
  assert.ok(!seen.includes(res[5].hourly));
});
