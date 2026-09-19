import assert from 'node:assert/strict';
import test from 'node:test';

let nextImport=0;
const fields=[
  'geopotential_height_500hPa','temperature_850hPa',
  'relative_humidity_850hPa','wind_speed_850hPa',
  'wind_direction_850hPa','precipitation'
];

function sampleHour(value=2,height=5580){
  return {
    time:Array.from({length:73},(_,i)=>new Date(Date.UTC(2026,8,19,i)).toISOString()),
    geopotential_height_500hPa:Array(73).fill(height),
    temperature_850hPa:Array(73).fill(18),
    relative_humidity_850hPa:Array(73).fill(75),
    wind_speed_850hPa:Array(73).fill(8),
    wind_direction_850hPa:Array(73).fill(270),
    precipitation:Array(73).fill(value)
  };
}
const response=(value=2,omit)=>({ok:true,json:async()=>
  Array.from({length:99},(_,i)=>{
    const hourly=sampleHour(value,5500+(i%11)*10);
    if(omit) delete hourly[omit];
    return {hourly};
  })});

async function until(predicate){
  for(let i=0;i<80&&!predicate();i++)
    await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok(predicate(),'the UI did not settle as expected');
}

async function harness(fetchImpl,{ordinaryName='moistureFlux850',includeNativeApp=false}={}){
  const classes=()=>{
    const values=new Set();
    return {add:value=>values.add(value),remove:value=>values.delete(value),
      contains:value=>values.has(value),toggle:value=>values.has(value)?values.delete(value):values.add(value)};
  };
  const node=()=>({classList:classes(),textContent:'',innerHTML:'',value:'0',
    style:{},selectedOptions:[{textContent:'CMA GRAPES'}],handlers:{},
    append(){},
    addEventListener(name,handler){this.handlers[name]=handler}});
  const consultation={...node(),dataset:{moisture:'consultationComposite'}};
  const ordinary={...node(),dataset:{moisture:ordinaryName}};
  const product={...node(),dataset:{product:'radar'}};
  if(includeNativeApp)product.classList.add('active');
  const elements=new Map();
  const get=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id)};
  get('modelSelect').value='cma';
  get('forecastHour').value='0';
  globalThis.document={
    getElementById:get,
    querySelectorAll:selector=>selector==='.moisture-tab'?[consultation,ordinary]:
      selector==='.product-tab'?[product]:
      selector==='.product-tab,.dynamic-tab'?[product]:
      selector==='.product-tab,.dynamic-tab,.moisture-tab'?[product,consultation,ordinary]:[],
    querySelector:selector=>selector==='.moisture-tab.active'?
      [consultation,ordinary].find(button=>button.classList.contains('active'))||null:
      selector==='.product-tab.active'?
        (product.classList.contains('active')?product:null):
      selector==='.moisture-tab.active,.dynamic-tab.active'?
        [consultation,ordinary].find(button=>button.classList.contains('active'))||null:null,
    createElement:()=>({width:0,height:0,toDataURL:()=>'',
      getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
        putImageData(){}})})
  };
  const added=[],removed=[];
  const layer=kind=>({kind,children:[],addTo(parent){
    added.push(this);if(parent?.children)parent.children.push(this);return this;
  }});
  globalThis.L={
    map:()=>({setView(){return this},on(){return this},removeLayer(item){removed.push(item)},invalidateSize(){}}),
    tileLayer:()=>layer('tile'),imageOverlay:()=>layer('raster'),
    layerGroup:()=>layer('group'),marker:()=>layer('marker'),
    polyline:()=>layer('contour'),divIcon:()=>({})
  };
  const requests=[];
  globalThis.fetch=url=>{requests.push(new URL(url));return fetchImpl(url)};
  if(includeNativeApp)await import(`../web/app.js?ui-${++nextImport}`);
  await import(`../web/moisture.mjs?ui-${++nextImport}`);
  return {consultation,ordinary,product,get,added,removed,requests,
    badge:get('statusBadge'),notes:get('productNotes')};
}

test('the visible consultation entry requests one coherent model and renders all layers',async()=>{
  const ui=await harness(async()=>response());
  ui.consultation.handlers.click();
  await until(()=>ui.badge.textContent==='数据已更新');
  assert.equal(ui.requests.length,1);
  assert.deepEqual(ui.requests[0].searchParams.get('hourly').split(','),fields);
  assert.equal(ui.requests[0].searchParams.get('forecast_hours'),'73');
  assert.equal(ui.requests[0].searchParams.get('latitude').split(',').length,99);
  assert.equal(ui.get('sourceText').textContent,'Open-Meteo pressure levels → derived');
  assert.match(ui.get('validTime').textContent,/2026-09-19.*2026-09-20/);
  assert.match(ui.notes.textContent,/24 小时.*降水/);
  assert.match(ui.notes.textContent,/关注等级：重点关注/);
  assert.match(ui.notes.textContent,/derived/);
  assert.equal(ui.added.filter(item=>item.kind==='group').length,2);
  assert.ok(ui.added.some(item=>item.kind==='contour'));
  assert.ok(ui.added.some(item=>item.kind==='marker'));
});

test('native weather loading cannot rewrite an active consultation',async()=>{
  let resolveRadar;
  const ui=await harness(url=>new URL(url).host==='api.rainviewer.com'?
    new Promise(resolve=>{resolveRadar=resolve}):Promise.resolve(response()),
    {includeNativeApp:true});
  assert.equal(ui.requests.length,1);
  ui.consultation.handlers.click();
  await until(()=>ui.badge.textContent==='数据已更新');
  ui.get('modelSelect').value='gfs';
  ui.get('modelSelect').onchange();
  ui.get('modelSelect').handlers.change();
  await until(()=>ui.badge.textContent==='数据已更新');
  assert.equal(ui.requests.length,3,'only the active consultation should request the new model');
  ui.get('forecastHour').value='3';
  ui.get('forecastHour').onchange();
  ui.get('forecastHour').handlers.change();
  await until(()=>/03:00/.test(ui.get('validTime').textContent));
  assert.equal(ui.requests.length,4,'only the active consultation should request the new hour');
  const notes=ui.notes.textContent,validTime=ui.get('validTime').textContent;
  assert.equal(ui.get('productTitle').textContent,'综合会商');
  resolveRadar({ok:true,json:async()=>({host:'https://tilecache.rainviewer.com',
    radar:{past:[{time:1726700000,path:'/v2/radar/test'}]}})});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(ui.get('productTitle').textContent,'综合会商');
  assert.equal(ui.get('validTime').textContent,validTime);
  assert.equal(ui.notes.textContent,notes);
  assert.equal(ui.badge.textContent,'数据已更新');
});

test('a partly missing grid displays its shortage ratio without a grade',async()=>{
  const ui=await harness(async()=>({ok:true,json:async()=>
    Array.from({length:99},(_,i)=>{
      const hourly=sampleHour(2,5500+(i%11)*10);
      if(i===98)hourly.precipitation[3]=null;
      return {hourly};
    })}));
  ui.consultation.handlers.click();
  await until(()=>ui.badge.textContent==='数据已更新');
  assert.match(ui.notes.textContent,/有效采样点 98\/99/);
  assert.match(ui.notes.textContent,/缺测 1\/99/);
  assert.match(ui.notes.textContent,/有效点最大值 48 mm/);
  assert.doesNotMatch(ui.notes.textContent,/关注等级：/);
});

test('missing fields and incomplete 24 hours clear the previous result',async()=>{
  let next=response();
  const ui=await harness(async()=>next);
  ui.consultation.handlers.click();
  await until(()=>ui.badge.textContent==='数据已更新');
  const previous=ui.added.filter(item=>item.kind==='group');
  const raster=ui.added.find(item=>item.kind==='raster');

  next=response(2,'wind_direction_850hPa');
  ui.consultation.handlers.click();
  await until(()=>ui.badge.textContent==='数据不足');
  assert.match(ui.notes.textContent,/wind_direction_850hPa/);
  assert.equal(ui.get('validTime').textContent,'—');
  assert.ok(previous.every(item=>ui.removed.includes(item)));
  assert.ok(ui.removed.includes(raster));
  assert.doesNotMatch(ui.notes.textContent,/采样网格区域最大/);

  next=response();
  ui.get('forecastHour').value='51';
  ui.get('forecastHour').handlers.change();
  await until(()=>ui.badge.textContent==='数据不足'&&/24 小时/.test(ui.notes.textContent));
  assert.equal(ui.get('validTime').textContent,'—');
});

test('slower older model request cannot overwrite the selected model and hour',async()=>{
  const resolvers=[];
  const ui=await harness(()=>new Promise(resolve=>resolvers.push(resolve)));
  ui.consultation.handlers.click();
  ui.get('modelSelect').value='gfs';
  ui.get('modelSelect').selectedOptions[0].textContent='NCEP GFS';
  ui.get('forecastHour').value='3';
  ui.get('modelSelect').handlers.change();
  assert.equal(resolvers.length,2);
  assert.match(ui.requests[0].pathname,/cma/);
  assert.match(ui.requests[1].pathname,/gfs/);
  resolvers[1](response(2));
  await until(()=>ui.badge.textContent==='数据已更新');
  const latest=ui.notes.textContent;
  const visibleTime=ui.get('validTime').textContent;
  assert.match(latest,/48 mm/);
  assert.match(visibleTime,/03:00/);
  resolvers[0](response(1));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(ui.notes.textContent,latest);
  assert.equal(ui.get('validTime').textContent,visibleTime);
  assert.equal(ui.badge.textContent,'数据已更新');
});

test('an older moisture product cannot repaint a newer consultation',async()=>{
  for(const ordinaryName of ['moistureFlux850','moistureFluxDivergence850']){
    const resolvers=[];
    const ui=await harness(()=>new Promise(resolve=>resolvers.push(resolve)),{ordinaryName});
    ui.ordinary.handlers.click();
    ui.consultation.handlers.click();
    assert.equal(resolvers.length,2);
    resolvers[1](response(2));
    await until(()=>ui.badge.textContent==='数据已更新');
    const notes=ui.notes.textContent;
    const rasterCount=ui.added.filter(item=>item.kind==='raster').length;
    assert.equal(ui.get('productTitle').textContent,'综合会商');
    resolvers[0](response(1));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(ui.get('productTitle').textContent,'综合会商');
    assert.equal(ui.notes.textContent,notes);
    assert.equal(ui.added.filter(item=>item.kind==='raster').length,rasterCount);
  }
});

test('an abandoned vertical section does not request omega or restore its chart',async()=>{
  const resolvers=[];
  const ui=await harness(()=>new Promise(resolve=>resolvers.push(resolve)),
    {ordinaryName:'verticalSection'});
  ui.ordinary.handlers.click();
  ui.consultation.handlers.click();
  assert.equal(resolvers.length,2);
  resolvers[1](response(2));
  await until(()=>ui.badge.textContent==='数据已更新');
  resolvers[0](response(1));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(resolvers.length,2);
  assert.equal(ui.get('productTitle').textContent,'综合会商');
  assert.ok(ui.get('sectionChart').classList.contains('hidden'));
});

test('switching to an original product invalidates a pending consultation request',async()=>{
  let resolveRequest;
  let initial=true;
  const ui=await harness(()=>initial?Promise.resolve(response()):
    new Promise(resolve=>{resolveRequest=resolve}));
  ui.consultation.handlers.click();
  await until(()=>ui.badge.textContent==='数据已更新');
  const firstGroups=ui.added.filter(item=>item.kind==='group');
  initial=false;
  ui.consultation.handlers.click();
  ui.product.handlers.click();
  ui.get('productTitle').textContent='天气雷达';
  assert.ok(firstGroups.every(item=>ui.removed.includes(item)));
  assert.ok(ui.get('moistureMap').classList.contains('hidden'));
  const addedBefore=ui.added.length;
  resolveRequest(response(8));
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(ui.get('productTitle').textContent,'天气雷达');
  assert.equal(ui.added.length,addedBefore);
  assert.notEqual(ui.badge.textContent,'数据已更新');
});
