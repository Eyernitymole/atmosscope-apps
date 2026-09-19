import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const webdriver='http://127.0.0.1:9515';
const site='http://127.0.0.1:8765/index.html';
const output=path.resolve('artifacts');
const fixture=`(() => {
  const realFetch=window.fetch.bind(window);
  window.__atmoMode='complete';
  window.fetch=async (input,options) => {
    const url=new URL(String(input),location.href);
    if(url.hostname==='api.rainviewer.com')
      return new Response(JSON.stringify({radar:{past:[]}}),{status:200});
    if(url.hostname!=='api.open-meteo.com')return realFetch(input,options);
    const count=url.searchParams.get('latitude').split(',').length;
    const time=Array.from({length:73},(_,i)=>new Date(Date.UTC(2026,8,19,i)).toISOString());
    const points=Array.from({length:count},(_,i)=>{
      const hourly={time,
        geopotential_height_500hPa:Array(73).fill(5500+(i%11)*10),
        temperature_850hPa:Array(73).fill(18),
        relative_humidity_850hPa:Array(73).fill(75),
        wind_speed_850hPa:Array(73).fill(8),
        wind_direction_850hPa:Array(73).fill(270),
        precipitation:Array(73).fill(2)};
      if(window.__atmoMode==='partial'&&i===count-1)hourly.precipitation[3]=null;
      if(window.__atmoMode==='missing')delete hourly.wind_direction_850hPa;
      return {hourly};
    });
    return new Response(JSON.stringify(count===1?points[0]:points),{status:200,
      headers:{'Content-Type':'application/json'}});
  };
})();`;

async function command(method,route,body){
  const response=await fetch(webdriver+route,{method,
    headers:{'Content-Type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)});
  const result=await response.json();
  if(!response.ok||result.value?.error)
    throw new Error(`WebDriver ${method} ${route}: ${JSON.stringify(result.value).slice(0,750)}`);
  return result.value;
}
async function waitFor(fn,label,timeout=25000){
  const deadline=Date.now()+timeout;
  let last;
  while(Date.now()<deadline){
    try{last=await fn();if(last)return last}catch(error){last=error.message}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(`${label} timeout: ${JSON.stringify(last)}`);
}
async function liveProvider(){
  const fields=['geopotential_height_500hPa','temperature_850hPa',
    'relative_humidity_850hPa','wind_speed_850hPa',
    'wind_direction_850hPa','precipitation'];
  const latitude=Array.from({length:99},(_,i)=>15+5*Math.floor(i/11)).join(',');
  const longitude=Array.from({length:99},(_,i)=>75+6*(i%11)).join(',');
  const query=new URLSearchParams({latitude,longitude,hourly:fields.join(','),
    forecast_hours:'73',timezone:'GMT',wind_speed_unit:'ms'});
  try{
    const response=await fetch(`https://api.open-meteo.com/v1/cma?${query}`,
      {signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    const points=Array.isArray(data)?data:[data];
    return {httpStatus:response.status,reason:data.reason??null,pointCount:points.length,
      fields:Object.fromEntries(fields.map(name=>[name,
        points.every(point=>Array.isArray(point.hourly?.[name]))?
          Math.min(...points.map(point=>point.hourly[name].length)):null]))};
  }catch(error){return {unavailable:String(error.message??error)}}
}

const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1',
  '--directory','web'],{stdio:'ignore'});
const driver=spawn(path.join(process.env.CHROMEWEBDRIVER??'/usr/local/share/chromedriver-linux64',
  'chromedriver'),['--port=9515'],{stdio:'ignore'});
let session;
try{
  await mkdir(output,{recursive:true});
  await waitFor(async()=>{
    if(server.exitCode!==null||driver.exitCode!==null)
      throw new Error(`server=${server.exitCode}, driver=${driver.exitCode}`);
    const [page,status]=await Promise.all([
      fetch(site,{signal:AbortSignal.timeout(1000)}),
      fetch(webdriver+'/status',{signal:AbortSignal.timeout(1000)})]);
    return page.ok&&status.ok;
  },'local web server and ChromeDriver',15000);
  const created=await command('POST','/session',{capabilities:{alwaysMatch:{
    browserName:'chrome',pageLoadStrategy:'eager',
    'goog:chromeOptions':{args:['--headless=new','--no-sandbox',
      '--disable-dev-shm-usage','--window-size=1440,1000']}}}});
  session=created.sessionId;
  const route=`/session/${session}`;
  const evaluate=script=>command('POST',route+'/execute/sync',{script,args:[]});
  const capture=async filename=>{
    const height=await evaluate(`return Math.max(document.body.scrollHeight,
      document.documentElement.scrollHeight)`);
    const screenshot=await command('POST',route+'/goog/cdp/execute',
      {cmd:'Page.captureScreenshot',params:{format:'png',captureBeyondViewport:true,
        clip:{x:0,y:0,width:1440,height,scale:1}}});
    await writeFile(path.join(output,filename),Buffer.from(screenshot.data,'base64'));
  };
  const click=async selector=>{
    const element=await command('POST',route+'/element',
      {using:'css selector',value:selector});
    const id=element['element-6066-11e4-a52e-4f735466cecf'];
    await command('POST',route+`/element/${id}/click`,{});
  };
  const view=()=>evaluate(`return {
    badge:document.querySelector('#statusBadge')?.textContent,
    title:document.querySelector('#productTitle')?.textContent,
    notes:document.querySelector('#productNotes')?.textContent,
    time:document.querySelector('#validTime')?.textContent,
    modelVisible:getComputedStyle(document.querySelector('#modelControl')).display!=='none',
    hourVisible:getComputedStyle(document.querySelector('#forecastControl')).display!=='none',
    mapVisible:getComputedStyle(document.querySelector('#moistureMap')).display!=='none',
    rasters:document.querySelectorAll('#moistureMap .leaflet-image-layer').length,
    contours:document.querySelectorAll('#moistureMap path.height-contour-line').length,
    vectors:document.querySelectorAll('#moistureMap .moisture-vector-arrow').length
  }`);
  await command('POST',route+'/goog/cdp/execute',
    {cmd:'Page.addScriptToEvaluateOnNewDocument',params:{source:fixture}});
  await command('POST',route+'/url',{url:site});
  await waitFor(async()=>evaluate('return Boolean(window.L&&window.Plotly)'),
    'Leaflet and Plotly CDN scripts',30000);
  await click('button[data-moisture="consultationComposite"]');
  const first=await waitFor(async()=>{
    const state=await view();return state.badge==='数据已更新'&&state.rasters>0?state:null;
  },'composite map');
  assert.equal(first.title,'综合会商');
  assert.ok(first.modelVisible&&first.hourVisible&&first.mapVisible);
  assert.ok(first.contours>0&&first.vectors>0,
    `Missing contour or moisture vectors: ${JSON.stringify(first)}`);
  assert.match(first.notes,/关注等级：重点关注/);
  await capture('consultation-complete.png');
  await evaluate(`const model=document.querySelector('#modelSelect');model.value='gfs';
    model.dispatchEvent(new Event('change',{bubbles:true}));
    const hour=document.querySelector('#forecastHour');hour.value='3';
    hour.dispatchEvent(new Event('change',{bubbles:true}));`);
  await waitFor(async()=>{
    const state=await view();return state.badge==='数据已更新'&&
      state.time?.includes('03:00')?state:null;
  },'new model and forecast hour');
  await evaluate(`window.__atmoMode='partial'`);
  await click('button[data-moisture="consultationComposite"]');
  const partial=await waitFor(async()=>{
    const state=await view();return state.notes?.includes('缺测 1/99')?state:null;
  },'partial coverage');
  assert.doesNotMatch(partial.notes,/关注等级：/);
  await capture('consultation-partial.png');
  await evaluate(`window.__atmoMode='missing'`);
  await click('button[data-moisture="consultationComposite"]');
  const missing=await waitFor(async()=>{
    const state=await view();return state.badge==='数据不足'?state:null;
  },'missing provider field');
  assert.match(missing.notes,/wind_direction_850hPa/);
  assert.equal(missing.rasters,0);
  console.log('BROWSER_SMOKE',JSON.stringify({complete:first,partial,missing}));
  const live=await liveProvider();
  await writeFile(path.join(output,'live-provider.json'),JSON.stringify(live,null,2));
  console.log('LIVE_PROVIDER',JSON.stringify(live));
}finally{
  if(session)await command('DELETE',`/session/${session}`).catch(()=>{});
  server.kill();driver.kill();
}
