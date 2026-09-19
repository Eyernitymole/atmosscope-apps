# AtmosScope v1.6 Consultation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing 综合会商 entry render a truthful 500 hPa height / 850 hPa moisture / next-24-hour precipitation product and rule-based note, then safely release v1.6.0.

**Architecture:** A pure grid adapter validates a single Open-Meteo response before existing moisture formulas derive transport. A rule module and Leaflet renderer consume the validated composite; `moisture.mjs` owns only page state, request ordering, and layer cleanup. Version bump and release are gated on runtime checks, not static CI alone.

**Tech Stack:** Browser ES modules, Leaflet, Open-Meteo model endpoints, Node `node:test`, GitHub Actions, Android Gradle, Windows .NET/Inno Setup.

**Spec:** `docs/superpowers/specs/2026-09-19-atmosscope-v1.6-consultation-design.md`

## Global Constraints

- Work on PR #12 (`agent/v1.6-consultation`); preserve the currently passing 32 tests and all original atlas controls.
- Use the selected model's existing Open-Meteo endpoint, a 9×11 grid, 73 forecast hours, and exactly `geopotential_height_500hPa`, `temperature_850hPa`, `relative_humidity_850hPa`, `wind_speed_850hPa`, `wind_direction_850hPa`, `precipitation`.
- A next-24-hour total requires 24 complete hourly values beginning at the selected index. `0` is valid; `null`, missing, negative precipitation, or non-finite values are not substituted with zero.
- Never call derived sampled fields an original full-resolution product or an official warning; no AI-generated weather claims, invented radar/typhoon fields, new model provider, or unrelated UI redesign.
- Maintain original `moistureFlux850`, `moistureFluxDivergence850`, `verticalSection` behavior; do not reload `moisture-v16-patch.mjs` from HTML.
- Bump both `.release-version` and `package.json` to `1.6.0` only after functional checks. Check tag `v1.6.0` and release assets before claiming release.

## Review Focus

1. A provider returns `null` for one hour while another point reports `0`: missing must stay missing, valid dry weather must stay zero (Task 1 test).
2. Forecast index 48 has 24 values but index 51 has fewer: the latter must not be labeled a full 24-hour total (Task 1 test).
3. A response has a wrong point count or a point's time index differs: reject the composite rather than map values to the wrong coordinate (Task 1 test).
4. Only scattered valid points remain, with no valid 2×2 cell: render no filled field and report insufficient data (Task 1 test).
5. An old slow request completes after a new model/time selection: old data must not overwrite the visible product (Task 4 test).

---

### Task 1: Validate and Shape Consultation Fields

**Files:**
- Create: `web/consultation-data.mjs`
- Create: `tests/consultation-data-v1.6.test.mjs`

**Interfaces:**
- Consumes: Open-Meteo response objects `res`, latitude array `lats`, longitude array `lons`, selected forecast index `index`, and the already existing `trailingPrecipitation(hourly,index)` passed as `accumulate24`.
- Produces: `buildConsultationData(res,lats,lons,index,accumulate24)` returning `{status:'ready',grid:{height500,temp850,rh850,speed850,dir850,rain24},coverage:{valid,total},time:{start,end}}` or `{status:'insufficient',reason,missing}`. Invalid cells are `NaN` across all matrices.

- [ ] **Step 1: Write failing data-contract tests.** Include a 2×3 fixture with hourly arrays. Assert a real zero returns `0`, one `null` yields `NaN` and coverage `5/6`, an out-of-range index yields `insufficient`, a mismatched response count or time yields `insufficient`, a discontinuous 24-hour time axis yields `insufficient`, and a grid without a valid 2×2 cell yields `insufficient`.

```js
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
const sum24=(h,i)=>h.precipitation.slice(i,i+24).reduce((a,b)=>a+b,0);
test('dry zero is valid while a null hour removes only its point',()=>{
  const res=Array.from({length:6},()=>({hourly:hourly()}));
  res[5].hourly.precipitation[3]=null;
  const out=buildConsultationData(res,[20,25],[100,105,110],0,sum24);
  assert.equal(out.status,'ready');
  assert.deepEqual(out.coverage,{valid:5,total:6});
  assert.equal(out.grid.rain24[0][0],0);
  assert.ok(Number.isNaN(out.grid.rain24[1][2]));
});
test('incomplete 24-hour horizon and wrong point count are insufficient',()=>{
  const res=Array.from({length:6},()=>({hourly:hourly()}));
  assert.equal(buildConsultationData(res,[20,25],[100,105,110],51,sum24).status,'insufficient');
  assert.equal(buildConsultationData(res.slice(1),[20,25],[100,105,110],0,sum24).status,'insufficient');
  assert.equal(buildConsultationData(res,[20,25],[100,105,110],48,sum24).status,'ready');
});
test('mismatched time and isolated valid points cannot make a composite',()=>{
  const res=Array.from({length:6},()=>({hourly:hourly()}));
  res[1].hourly.time[0]='2026-09-22T00:00:00.000Z';
  assert.equal(buildConsultationData(res,[20,25],[100,105,110],0,sum24).status,'insufficient');
  res[1].hourly.time[0]=res[0].hourly.time[0];
  res[1].hourly.precipitation[0]=null;
  res[4].hourly.precipitation[0]=null;
  assert.equal(buildConsultationData(res,[20,25],[100,105,110],0,sum24).status,'insufficient');
});
test('24 aligned hourly timestamps are required at every point',()=>{
  const res=Array.from({length:6},()=>({hourly:hourly()}));
  res[2].hourly.time[8]='2026-09-19T11:00:00.000Z';
  assert.equal(buildConsultationData(res,[20,25],[100,105,110],0,sum24).status,'insufficient');
});
test('provider GMT timestamps without an explicit offset are accepted as UTC',()=>{
  const res=Array.from({length:6},()=>({hourly:hourly()}));
  for(const point of res)point.hourly.time=point.hourly.time.map(t=>t.slice(0,16));
  const out=buildConsultationData(res,[20,25],[100,105,110],0,sum24);
  assert.equal(out.status,'ready');
  assert.equal(out.time.start,'2026-09-19T00:00:00.000Z');
});
test('negative precipitation invalidates that point, not a valid zero nearby',()=>{
  const res=Array.from({length:6},()=>({hourly:hourly()}));
  res[5].hourly.precipitation[0]=-1;
  const out=buildConsultationData(res,[20,25],[100,105,110],0,sum24);
  assert.equal(out.status,'ready');
  assert.equal(out.coverage.valid,5);
  assert.ok(Number.isNaN(out.grid.rain24[1][2]));
});
```

- [ ] **Step 2: Verify red.** Run `node --test tests/consultation-data-v1.6.test.mjs`; expected failure: the module/export does not yet exist. All six tests above must be present before moving on.
- [ ] **Step 3: Implement the pure adapter.** Compare `res.length` with `lats.length*lons.length`; require parseable, hourly-spaced, identical `hourly.time[index..index+23]` at all points; require `index+24 <= precipitation.length`. The request uses `timezone:'GMT'`, so interpret Open-Meteo's timezone-less `YYYY-MM-DDTHH:mm` timestamps as UTC, while also accepting explicit UTC offsets; do not parse timezone-less strings as browser-local time or require the provider to emit `.000Z`. Check the six named arrays before converting a value, then validate humidity `0..100`, nonnegative wind speed and precipitation. Accept a partially valid field only if at least one 2×2 cell has all four points valid. Fill invalid cells with `NaN` and call `accumulate24` only after all 24 entries at that point pass.

```js
const FIELDS=['geopotential_height_500hPa','temperature_850hPa',
  'relative_humidity_850hPa','wind_speed_850hPa',
  'wind_direction_850hPa','precipitation'];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const utcTime=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(x)
  ? Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(x)?x:`${x}Z`) : NaN;
const fail=(reason,missing=[])=>({status:'insufficient',reason,missing});
export function buildConsultationData(res,lats,lons,index,accumulate24){
  const rows=lats.length,cols=lons.length,total=rows*cols;
  if(!Array.isArray(res)||res.length!==total||rows<2||cols<2)
    return fail('采样网格点数不一致');
  if(!Number.isInteger(index)||index<0)return fail('预报时效无效');
  const start=res[0]?.hourly?.time?.[index],startMs=utcTime(start);
  if(!Number.isFinite(startMs)||res.some(p=>utcTime(p?.hourly?.time?.[index])!==startMs))
    return fail('预报时刻缺失或错位');
  if(res.every(p=>(p?.hourly?.precipitation?.length||0)<index+24))
    return fail('完整 24 小时预报时段不足');
  for(let hour=0;hour<24;hour++){
    const expected=startMs+hour*3600000;
    if(res.some(p=>utcTime(p?.hourly?.time?.[index+hour])!==expected))
      return fail('24 小时预报时间轴不连续或错位');
  }
  const missing=FIELDS.filter(key=>res.every(p=>!Array.isArray(p?.hourly?.[key])));
  if(missing.length)return fail('模式字段不可用',missing);
  const grid={height500:[],temp850:[],rh850:[],speed850:[],dir850:[],rain24:[]};
  const names=['height500','temp850','rh850','speed850','dir850','rain24'];
  const mask=[];let valid=0;
  for(let r=0;r<rows;r++){
    mask[r]=[];for(const name of names)grid[name][r]=[];
    for(let c=0;c<cols;c++){
      const h=res[r*cols+c]?.hourly;
      const values=FIELDS.slice(0,5).map(k=>h?.[k]?.[index]);
      const p=h?.precipitation?.slice(index,index+24);
      const ok=values.every(finite)&&Array.isArray(p)&&p.length===24&&
        p.every(x=>finite(x)&&Number(x)>=0)&&
        Number(values[2])>=0&&Number(values[2])<=100&&
        Number(values[3])>=0&&Number(values[4])>=0&&Number(values[4])<=360;
      const rain=ok?accumulate24(h,index):NaN;
      mask[r][c]=ok&&Number.isFinite(rain);
      if(mask[r][c])valid++;
      const record=mask[r][c]?[...values.map(Number),rain]:Array(6).fill(NaN);
      names.forEach((name,i)=>grid[name][r][c]=record[i]);
    }
  }
  let cell=false;
  for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++)
    cell ||= mask[r][c]&&mask[r+1][c]&&mask[r][c+1]&&mask[r+1][c+1];
  if(!cell)return fail('有效网格不足以绘制组合图');
  return {status:'ready',grid,coverage:{valid,total},
    time:{start:new Date(startMs).toISOString(),
      end:new Date(startMs+24*3600000).toISOString()}};
}
```

- [ ] **Step 4: Verify green and regression.** Run `node --test tests/consultation-data-v1.6.test.mjs` and `npm test`; expected all tests pass, including discontinuous time, negative precipitation, zero rain and a sparse invalid grid.
- [ ] **Step 5: Commit.** `git add web/consultation-data.mjs tests/consultation-data-v1.6.test.mjs && git commit -m "feat: validate consultation model fields"`.

### Task 2: One Conservative Rule Engine and Fallback

**Files:**
- Modify: `web/consultation-summary.mjs`
- Modify: `web/consultation-controller.mjs`
- Test: `tests/consultation-controller-v1.6.test.mjs`
- Create: `tests/consultation-summary-v1.6.test.mjs`

**Interfaces:**
- Consumes: validated `{status:'ready',coverage,grid}` plus derived moisture magnitude, never raw provider objects.
- Produces: `summarizeConsultation({rain24,moistureMagnitude,coverage}) -> {risk,factors,text,method}`; `diagnoseConsultation(input)` returns a panel or existing `{status:'fallback',message:'数据不足',reason}`.

- [ ] **Step 1: Add failing behavior tests.** `rain24=[[0,12],[30,4]]` and coverage `4/4` yields max `30 mm`, `risk:'重点关注'`, and explicitly says the 10/30 mm cutoffs are internal screening, not official warnings. Coverage `3/4` yields `risk:'未判定'`, text naming `3/4` valid points. All missing or a rejected adapter result yields fallback with its reason; valid zero rain is not treated as missing. Extend the existing controller test without deleting its source-compatibility assertions.

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnoseConsultation } from '../web/consultation-controller.mjs';

test('complete fields give only a labeled internal screening grade',()=>{
  const p=diagnoseConsultation({status:'ready',rain24:[[0,12],[30,4]],
    moistureMagnitude:[[2,3],[4,5]],coverage:{valid:4,total:4}});
  assert.equal(p.risk,'重点关注');
  assert.match(p.text,/30 mm/);
  assert.match(p.text,/不是官方预警/);
});
test('partial coverage reports facts without a risk grade',()=>{
  const p=diagnoseConsultation({status:'ready',rain24:[[0,12],[30,NaN]],
    moistureMagnitude:[[2,3],[4,NaN]],coverage:{valid:3,total:4}});
  assert.equal(p.risk,'未判定');
  assert.match(p.text,/3\/4/);
});
test('bad input preserves data-shortage reason',()=>{
  const p=diagnoseConsultation({status:'insufficient',reason:'完整 24 小时预报时段不足'});
  assert.equal(p.status,'fallback');
  assert.match(p.reason,/24 小时/);
});
test('zero precipitation is a measured dry value',()=>{
  const p=diagnoseConsultation({status:'ready',rain24:[[0,0],[0,0]],
    moistureMagnitude:[[0,0],[0,0]],coverage:{valid:4,total:4}});
  assert.equal(p.risk,'一般');
  assert.match(p.text,/0 mm/);
});
```

- [ ] **Step 2: Verify red.** `node --test tests/consultation-controller-v1.6.test.mjs tests/consultation-summary-v1.6.test.mjs`; expect the new assertions to fail on today's placeholder panel and duplicate rules.
- [ ] **Step 3: Implement.** Make `consultation-controller.mjs` call `summarizeConsultation()` in `consultation-summary.mjs` and then `buildConsultationPanel()`; retain the exported `diagnoseConsultation`, `createConsultationResult`, `safeConsultation` names. Validate `status`, both matrices, matching nonzero `coverage`, and at least one finite entry before calling the summary; otherwise return `{title:'综合天气会商',status:'fallback',message:'数据不足',reason: input.reason || '必需诊断字段缺失'}`. Compute finite rain max only when full coverage; for partial coverage return facts only. Do not infer a 500 hPa trough from a min cell.

```js
export function summarizeConsultation({rain24,moistureMagnitude,coverage}){
  const values=rain24.flat().filter(Number.isFinite);
  if(!values.length||!moistureMagnitude.flat().some(Number.isFinite))
    return {risk:'未判定',factors:[],text:'数据不足',method:'采样网格 derived 诊断'};
  const maximum=Math.max(...values);
  if(coverage.valid!==coverage.total)return {risk:'未判定',factors:[],
    text:`有效采样点 ${coverage.valid}/${coverage.total}；有效点最大值 ${maximum} mm。`,
    method:'采样网格 derived 诊断；缺测时不分级'};
  const risk=maximum>=30?'重点关注':maximum>=10?'关注':'一般';
  return {risk,factors:['500 hPa高度场','850 hPa水汽输送'],
    text:`采样网格区域最大 24 小时降水 ${maximum} mm；10/30 mm 为 App 内部关注筛查线，不是官方预警。`,
    method:'真实模式字段 + 采样网格派生诊断'};
}
```

- [ ] **Step 4: Verify.** Run targeted tests, then `npm test`; expect all pass and controller fallback intact.
- [ ] **Step 5: Commit.** `git add web/consultation-summary.mjs web/consultation-controller.mjs tests/consultation-controller-v1.6.test.mjs tests/consultation-summary-v1.6.test.mjs && git commit -m "feat: ground consultation notes in validated fields"`.

### Task 3: Render Height Contours and Correct Moisture Direction

**Files:**
- Modify: `web/consultation-renderer.mjs`
- Modify: `web/consultation.css`
- Modify: `web/moisture.mjs` (only vector-angle helper and layer reset in this task)
- Test: `tests/consultation-renderer-v1.6.test.mjs`
- Test: `tests/moisture-v1.6-behavior.test.mjs`

**Interfaces:**
- Consumes: `height500` matrix, latitude/longitude arrays, and existing `contourSegments(grid,lats,lons,level)`; vectors from `addMoistureVectors(qu,qv)`.
- Produces: `renderHeightContourLayer(map,field,lats,lons,L) -> Leaflet layerGroup`; correct CSS angle for the moisture arrows; `clearConsultationLayers()` in `moisture.mjs` removes vector and contour groups.

- [ ] **Step 1: Write failing tests.** With height `[[5500,5600],[5500,5600]]`, 5520 m and 5580 m contours make polylines; a `NaN` corner makes no segment. A pure northward vector `(u=0,v=1)` must have angle `-90` degrees (CSS positive rotation points down); a pure eastward vector has angle `0`. Update the existing `tests/moisture-v1.6-behavior.test.mjs` angle assertion from positive `atan2` to negative while keeping all other existing assertions. Layer removal is covered by Task 4's UI test.

```js
const calls=[];
const L={layerGroup:()=>({addTo(){return this}}),
  polyline:(pts,opts)=>({pts,opts,addTo(){calls.push(this);return this}})};
const layer=renderHeightContourLayer({},[[5500,5600],[5500,5600]],
  [20,25],[100,105],L);
assert.ok(layer);
assert.ok(calls.some(x=>x.opts.className==='height-contour-line'));
calls.length=0;
renderHeightContourLayer({},[[5500,NaN],[5500,5600]],
  [20,25],[100,105],L);
assert.equal(calls.length,0);
assert.equal(addMoistureVectors([[0]],[[1]])[0].angle,-90);
assert.equal(addMoistureVectors([[1]],[[0]])[0].angle,0);
```

- [ ] **Step 2: Verify red.** Run `node --test tests/consultation-renderer-v1.6.test.mjs tests/moisture-v1.6-behavior.test.mjs`; expect missing contour layer and wrong northward angle failures.
- [ ] **Step 3: Implement.** Import `contourSegments` from `meteo.mjs`; loop levels `Math.ceil(min/60)*60` through `Math.floor(max/60)*60`, call `L.polyline(points,{className:'height-contour-line'})`. Skip non-finite corners via the existing contour utility. Change `moisture.mjs`'s exported `addMoistureVectors` angle to `-Math.atan2(v,u)*180/Math.PI` (do not accidentally edit the unused `consultation.mjs` copy). Track and remove both vector and contour layer groups in `draw()` before any new raster/product render; keep existing `draw()` behavior for earlier products. Add `.height-contour-line{stroke:#f0f5ff;stroke-width:1.5;opacity:.85}` to `consultation.css`.

```js
export function renderHeightContourLayer(map,field,lats,lons,L){
  const layer=L.layerGroup();
  const values=field.flat().filter(Number.isFinite);
  if(!values.length)return layer;
  for(let level=Math.ceil(Math.min(...values)/60)*60;
      level<=Math.floor(Math.max(...values)/60)*60;level+=60){
    for(const points of contourSegments(field,lats,lons,level))
      L.polyline(points,{className:'height-contour-line'}).addTo(layer);
  }
  return layer;
}
function clearConsultationLayers(){
  for(const layer of [vectorLayer,contourLayer])if(layer&&mmap)mmap.removeLayer(layer);
  vectorLayer=null;contourLayer=null;
}
```

- [ ] **Step 4: Verify.** Run targeted tests, `npm test`, and `node --check web/consultation-renderer.mjs && node --check web/moisture.mjs`; all pass.
- [ ] **Step 5: Commit.** `git add web/consultation-renderer.mjs web/consultation.css web/moisture.mjs tests/consultation-renderer-v1.6.test.mjs tests/moisture-v1.6-behavior.test.mjs && git commit -m "feat: render consultation layers with correct vector bearings"`.

### Task 4: Wire the Visible Button and Guard Stale Requests

**Files:**
- Modify: `web/moisture.mjs`
- Test: `tests/consultation-v1.6.test.mjs`
- Create: `tests/consultation-ui-v1.6.test.mjs`
- Verify: `web/index.html` (retain all original atlas controls; change only if the current DOM contract requires it)

**Interfaces:**
- Consumes: Task 1 `buildConsultationData`, Task 2 `diagnoseConsultation`, Task 3 `renderHeightContourLayer`, current `request`, `qMatrix`, `fluxComponents`, `draw`, and `addMoistureVectors`.
- Produces: `loadConsultationComposite({isCurrent})`; register it as `loaders.consultationComposite`; `run()` accepts loader result `{status:'ready'|'insufficient'|'stale'}` and writes the matching badge/side panel state.

- [ ] **Step 1: Write failing UI tests.** Use a small fake DOM + Leaflet harness and fake `fetch` responses; import `moisture.mjs` with a unique query string in each test so module state does not leak. Click the actual `[data-moisture="consultationComposite"]` handler, assert one request includes all six fields, side panel names the 24-hour window and derived source, and vector/contour layers are created. For a missing field or index 51, assert `statusBadge` says `数据不足` with a reason and no previous layer/decision remains. Resolve two fetch promises in reverse order after changing model/time; assert the first response cannot overwrite the second. Switch to an existing `.product-tab` while a consultation request is still pending; assert the old response cannot revive the consultation view and existing layers are removed.

```js
const classes=()=>({add(){},remove(){},toggle(){}});
const node=()=>({classList:classes(),textContent:'',innerHTML:'',value:'0',handlers:{},
  selectedOptions:[{textContent:'CMA GRAPES'}],
  addEventListener(name,fn){this.handlers[name]=fn}});
const button={...node(),dataset:{moisture:'consultationComposite'},handlers:{},
  addEventListener(name,fn){this.handlers[name]=fn}};
const productButton=node();
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id)};
get('modelSelect').value='cma';get('forecastHour').value='0';
const badge=get('statusBadge'),notes=get('productNotes');
globalThis.document={getElementById:get,
  querySelectorAll:sel=>sel==='.moisture-tab'?[button]:
    sel==='.product-tab,.dynamic-tab'?[productButton]:
    sel==='.product-tab,.dynamic-tab,.moisture-tab'?[productButton,button]:[],
  querySelector:()=>button,
  createElement:()=>({width:0,height:0,toDataURL:()=>'',
    getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
      putImageData(){}})})};
const layers=[],removed=[];
const layer=kind=>({kind,addTo(){layers.push(this);return this}});
globalThis.L={map:()=>({setView(){return this},removeLayer(x){removed.push(x)},invalidateSize(){}}),
  tileLayer:()=>layer('tile'),imageOverlay:()=>layer('raster'),
  layerGroup:()=>layer('group'),marker:()=>layer('marker'),
  polyline:()=>layer('contour'),
  divIcon:()=>({})};
const hour=()=>({time:Array.from({length:73},(_,i)=>
  new Date(Date.UTC(2026,8,19,i)).toISOString()),
  geopotential_height_500hPa:Array(73).fill(5580),
  temperature_850hPa:Array(73).fill(18),
  relative_humidity_850hPa:Array(73).fill(75),
  wind_speed_850hPa:Array(73).fill(8),
  wind_direction_850hPa:Array(73).fill(270),
  precipitation:Array(73).fill(2)});
let requested='';
globalThis.fetch=async url=>{requested=String(url);return {ok:true,
  json:async()=>Array.from({length:99},(_,i)=>{
    const h=hour();h.geopotential_height_500hPa.fill(5500+(i%11)*10);
    return {hourly:h};
  })}};
await import('../web/moisture.mjs?ui-smoke');
button.handlers.click();
const until=async predicate=>{
  for(let i=0;i<30&&!predicate();i++)await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok(predicate(),'the UI did not settle as expected');
};
await until(()=>badge.textContent==='数据已更新');
const fields=new URL(requested).searchParams.get('hourly').split(',');
assert.deepEqual(fields,['geopotential_height_500hPa','temperature_850hPa',
  'relative_humidity_850hPa','wind_speed_850hPa',
  'wind_direction_850hPa','precipitation']);
assert.equal(badge.textContent,'数据已更新');
assert.match(notes.textContent,/24 小时/);
assert.match(notes.textContent,/derived/);
assert.equal(layers.filter(x=>x.kind==='group').length,2);
assert.ok(layers.some(x=>x.kind==='contour'));
assert.ok(layers.some(x=>x.kind==='marker'));

// Run this scenario with a fresh harness/import in a separate test;
// the `button`, `get`, `until` and `notes` names refer to that test's harness.
let first,second;let calls=0;
globalThis.fetch=()=>new Promise(resolve=>{
  if(calls++===0)first=resolve;else second=resolve;
});
button.handlers.click();
get('modelSelect').value='gfs';
button.handlers.click();
const response=value=>({ok:true,json:async()=>Array.from({length:99},()=>{
  const h=hour();h.precipitation.fill(value);return {hourly:h};
})});
second(response(2));
await until(()=>badge.textContent==='数据已更新');
const latest=notes.textContent;
assert.match(latest,/48 mm/);
first(response(1));
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(notes.textContent,latest);
const before=removed.length;
productButton.handlers.click();
assert.ok(removed.length>before);
// Separate pending-request case: click consultation, switch to product, then
// resolve that request; the consultation layers, title and badge stay inactive.
```

- [ ] **Step 2: Verify red.** `node --test tests/consultation-ui-v1.6.test.mjs`; expect today’s `loaders[name] is not a function`, not a harness setup error.
- [ ] **Step 3: Implement the loader.** In `moisture.mjs`, call `request()` once with the six fields, then `buildConsultationData(...,trailingPrecipitation)`. On insufficient result, remove the current raster and both consultation layers, clear the prior decision/time, and put the reason in the side panel; on ready result, reuse `qMatrix/fluxComponents`, assemble via the already-exported local `consultationComposite` (whose result has `height.field`, `moisture.qu/qv`, `precipitation`), render 24-hour rain with `draw`, add contour and vector layers, and obtain notes from `diagnoseConsultation`. Check `isCurrent()` immediately after `await request()` and before all DOM/layer writes. Increment the request generation on any product/mode/hour change, including `.product-tab,.dynamic-tab` selection; clear map overlays when leaving consultation. `run()` must not mark insufficient or stale as updated.

```js
async function loadConsultationComposite({isCurrent=()=>true}={}){
  activate('综合会商','500 hPa 高度、850 hPa 水汽与未来 24 小时降水。');
  clearConsultationLayers();
  if(mlayer&&mmap){mmap.removeLayer(mlayer);mlayer=null}
  const fh=Number($('forecastHour').value),pts=points();
  const res=await request(pts.map(p=>p.lat),pts.map(p=>p.lon),[
    'geopotential_height_500hPa','temperature_850hPa',
    'relative_humidity_850hPa','wind_speed_850hPa',
    'wind_direction_850hPa','precipitation']);
  if(!isCurrent())return {status:'stale'};
  const data=buildConsultationData(res,LATS,LONS,fh,trailingPrecipitation);
  if(data.status!=='ready'){
    $('validTime').textContent='—';
    $('productNotes').textContent=`数据不足：${data.reason}`;
    return data;
  }
  const {grid,coverage,time}=data;
  const q=qMatrix(grid.temp850,grid.rh850,850);
  const f=fluxComponents(q,grid.speed850,grid.dir850);
  const composite=await consultationComposite({
    geopotential_height_500hPa:grid.height500,moistureFlux850:f,
    precipitation:grid.rain24});
  if(!isCurrent())return {status:'stale'};
  const values=grid.rain24.flat().filter(Number.isFinite);
  draw(composite.precipitation,0,Math.max(10,...values),
    ['#183a63','#337eaf','#64b8c4','#e5d05b','#d67143']);
  contourLayer=renderHeightContourLayer(mmap,composite.height.field,LATS,LONS,L)
    .addTo(mmap);
  vectorLayer=renderMoistureVectorLayer(mmap,
    addMoistureVectors(composite.moisture.qu,composite.moisture.qv),L).addTo(mmap);
  setLegend('linear-gradient(90deg,#183a63,#64b8c4,#e5d05b,#d67143)',
    '0 mm','24 h 较多');
  const panel=diagnoseConsultation({status:'ready',rain24:grid.rain24,
    moistureMagnitude:f.mag,coverage});
  $('validTime').textContent=`${time.start} → ${time.end}`;
  $('productNotes').textContent=
    `${panel.text} 有效点 ${coverage.valid}/${coverage.total}；`+
    '降水底色（mm）、500 hPa 等高线、850 hPa 水汽矢量均为采样网格 derived 诊断。';
  return {status:'ready'};
}
const loaders={moistureFlux850,moistureFluxDivergence850,verticalSection,
  consultationComposite:loadConsultationComposite};
let requestGeneration=0;
// Also increment requestGeneration in the existing product-tab and dynamic-tab
// click handlers, then clear consultation-only overlays before restoring UI.
async function run(name){
  const generation=++requestGeneration;
  $('statusBadge').textContent='加载中…';
  try{
    const result=await loaders[name]({isCurrent:()=>generation===requestGeneration});
    if(generation!==requestGeneration||result?.status==='stale')return;
    $('statusBadge').textContent=result?.status==='insufficient'?'数据不足':'数据已更新';
  }catch(error){
    if(generation!==requestGeneration)return;
    console.error(error);
    $('statusBadge').textContent='加载失败';
    $('productNotes').innerHTML+=`<p>错误：${String(error.message||error)}</p>`;
  }
}
```

- [ ] **Step 4: Verify all paths.** Run the UI test, `npm test`, `git diff --check`, and `node --check` on `app.js`, `dynamics.mjs`, `moisture.mjs`, `consultation.mjs`, `consultation-controller.mjs`. Run a local page smoke check for all original labels/controls and click the consultation entry with controlled data. If live Open-Meteo is reachable, check one real field response; if not, report the external limitation separately without treating fabricated fixtures as live validation.
- [ ] **Step 5: Commit.** `git add web/moisture.mjs tests/consultation-v1.6.test.mjs tests/consultation-ui-v1.6.test.mjs && git commit -m "feat: connect real-data consultation to atlas UI"`.

### Task 5: Version and Release Gate

**Files:**
- Modify: `.release-version`
- Modify: `package.json`
- Modify: `tests/release-config.test.mjs`
- Inspect without opportunistic edits: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: Task 4’s passing test suite and runtime smoke result.
- Produces: matching `1.6.0` source versions; then a green PR, merged `main`, and a verified Release asset set (outside the repository commit).

- [ ] **Step 1: Write a failing version-consistency test.**

```js
test('1.6.0 source and release versions agree',()=>{
  const file=readFileSync(new URL('../.release-version',import.meta.url),'utf8').trim();
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(file,'1.6.0');
  assert.equal(pkg.version,file);
});
```

- [ ] **Step 2: Verify red.** `node --test tests/release-config.test.mjs`; expect `1.5.0 !== 1.6.0`.
- [ ] **Step 3: Set both versions to `1.6.0`.** Keep existing release workflow unchanged unless a verified failure demands a focused fix. Do not remove/force-move a tag or overwrite an earlier release.

```text
.release-version: 1.6.0
package.json: "version": "1.6.0"
```

- [ ] **Step 4: Verify locally and commit.** Run `npm test`, JS syntax checks and `git diff --check`; commit only after all pass: `git add .release-version package.json tests/release-config.test.mjs && git commit -m "chore: prepare AtmosScope v1.6.0 release"`.
- [ ] **Step 5: Remote gate.** Update the existing PR #12 branch without force. Confirm its new head and the `Validate AtmosScope` job’s repository-test and JS-syntax steps are successful. Re-check `main` and `refs/tags/v1.6.0` immediately before merging. Stop if the tag already exists or branch protection blocks the merge.
- [ ] **Step 6: Merge and inspect release.** Merge PR #12 only after Task 4 runtime acceptance and PR CI pass. The `.release-version` change should trigger the existing Release workflow on `main`. Inspect the `Resolve release version`, `Android APK`, `Windows Setup`, and `Publish GitHub Release` jobs; inspect GitHub Releases for the exact three assets and compare `SHA256SUMS.txt` against downloaded APK/EXE. If signing or packaging fails, record the failing job and do not announce a release.

## Final Verification

- [ ] `npm test` passes in full, including every new behavior test.
- [ ] `node --check` passes for all edited modules and existing core modules.
- [ ] UI smoke confirms all original products and a functioning consultation button, truthful fallback, stale-request guard, and layer cleanup.
- [ ] PR #12 is green and merged to `main` only after the above.
- [ ] v1.6.0 Release contains `AtmosScope-Android.apk`, `AtmosScope-Windows-Setup.exe`, `SHA256SUMS.txt`, and checksums match the assets.
