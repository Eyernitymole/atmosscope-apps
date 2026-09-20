import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const webdriver = 'http://127.0.0.1:9515';
const site = 'http://127.0.0.1:8765/ordinary.html';
const output = path.resolve('artifacts');
const fixture = `(() => {
  const original = window.fetch.bind(window);
  const control = window.__ordinaryFixture = {
    mode: 'complete', holdSearch: false, holdForecastLat: null,
    pendingSearch: null, pendingForecast: null,
    releaseSearch() { this.pendingSearch?.(); this.pendingSearch = null; },
    releaseForecast() { this.pendingForecast?.(); this.pendingForecast = null; }
  };
  const json = (value, status = 200) => new Response(JSON.stringify(value),
    {status, headers: {'Content-Type': 'application/json'}});
  window.fetch = async (input, options) => {
    const url = new URL(String(input), location.href);
    if (url.hostname === 'geocoding-api.open-meteo.com') {
      const name = url.searchParams.get('name');
      if (control.holdSearch && name === 'slow') {
        control.holdSearch = false;
        await new Promise(resolve => { control.pendingSearch = resolve; });
        return json({results: [{name: 'Old result', country: 'Test', latitude: 8, longitude: 8}]});
      }
      if (name === 'fast') return json({results: [{name: 'New result', country: 'Test', latitude: 9, longitude: 9}]});
      return json({results: [
        {name: 'Springfield', admin1: 'A', country: 'Test', latitude: 1, longitude: 2},
        {name: 'Springfield', admin1: 'B', country: 'Test', latitude: 3, longitude: 4}
      ]});
    }
    if (url.hostname !== 'api.open-meteo.com') return original(input, options);
    const latitude = Number(url.searchParams.get('latitude'));
    if (control.holdForecastLat === latitude) {
      control.holdForecastLat = null;
      await new Promise(resolve => { control.pendingForecast = resolve; });
    }
    if (control.mode === 'error') return json({reason: 'fixture unavailable'}, 503);
    const first = Math.ceil(Date.now() / 3600000) * 3600;
    const hourlyTime = Array.from({length: 48}, (_, i) => first + i * 3600);
    const day = Math.floor(Date.now() / 86400000) * 86400;
    const dailyTime = Array.from({length: 7}, (_, i) => day + i * 86400 - 8 * 3600);
    const temperature = latitude === 3 ? 28 : latitude === 1 ? 19 : 23;
    return json({timezone: 'Asia/Shanghai', current: {
      time: first, temperature_2m: temperature, apparent_temperature: temperature + 1,
      relative_humidity_2m: 62, wind_speed_10m: 8, weather_code: 2
    }, hourly: {time: hourlyTime, temperature_2m: Array(48).fill(temperature),
      weather_code: Array(48).fill(2), precipitation: Array(48).fill(control.mode === 'missing' ? null : 0),
      precipitation_probability: Array(48).fill(10)},
    daily: {time: dailyTime, weather_code: Array(7).fill(2),
      temperature_2m_max: Array(7).fill(temperature + 3),
      temperature_2m_min: Array(7).fill(temperature - 3),
      precipitation_sum: Array(7).fill(control.mode === 'missing' ? null : 0),
      precipitation_probability_max: Array(7).fill(10)}});
  };
})();`;

async function command(method, route, body) {
  const response = await fetch(webdriver + route, {method,
    headers: {'Content-Type': 'application/json'},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    signal: AbortSignal.timeout(45000)});
  const result = await response.json();
  if (!response.ok || result.value?.error)
    throw new Error(`WebDriver ${method} ${route}: ${JSON.stringify(result.value).slice(0, 750)}`);
  return result.value;
}
async function waitFor(fn, label, timeout = 25000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { last = await fn(); if (last) return last; }
    catch (error) { last = error.message; }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`${label} timeout: ${JSON.stringify(last)}`);
}
async function liveProvider() {
  const fields = ['temperature_2m', 'weather_code', 'precipitation'];
  const query = new URLSearchParams({latitude: '23.1291', longitude: '113.2644',
    current: 'temperature_2m,weather_code', hourly: fields.join(','),
    daily: 'temperature_2m_max,temperature_2m_min', forecast_days: '7',
    timezone: 'auto', timeformat: 'unixtime'});
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`,
      {signal: AbortSignal.timeout(15000)});
    const data = await response.json();
    return {httpStatus: response.status, reason: data.reason ?? null,
      timezone: data.timezone ?? null, currentTemperature: Number.isFinite(data.current?.temperature_2m),
      hours: data.hourly?.time?.length ?? null, days: data.daily?.time?.length ?? null,
      fields: Object.fromEntries(fields.map(name => [name, data.hourly?.[name]?.length ?? null]))};
  } catch (error) { return {unavailable: String(error.message ?? error)}; }
}

const server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1',
  '--directory', 'web'], {stdio: 'ignore'});
const driver = spawn(path.join(process.env.CHROMEWEBDRIVER ?? '/usr/local/share/chromedriver-linux64',
  'chromedriver'), ['--port=9515'], {stdio: 'ignore'});
let session;
try {
  await mkdir(output, {recursive: true});
  await waitFor(async () => {
    if (server.exitCode !== null || driver.exitCode !== null)
      throw new Error(`server=${server.exitCode}, driver=${driver.exitCode}`);
    const [page, status] = await Promise.all([
      fetch(site, {signal: AbortSignal.timeout(1000)}),
      fetch(webdriver + '/status', {signal: AbortSignal.timeout(1000)})]);
    return page.ok && status.ok;
  }, 'local web server and ChromeDriver', 15000);
  const created = await command('POST', '/session', {capabilities: {alwaysMatch: {
    browserName: 'chrome', pageLoadStrategy: 'eager',
    'goog:chromeOptions': {args: ['--headless=new', '--no-sandbox',
      '--disable-dev-shm-usage', '--window-size=1440,1000']}}}});
  session = created.sessionId;
  const route = `/session/${session}`;
  const evaluate = script => command('POST', route + '/execute/sync', {script, args: []});
  const cdp = (cmd, params = {}) => command('POST', route + '/goog/cdp/execute', {cmd, params});
  const snapshot = () => evaluate(`return {
    city: document.querySelector('#cityName').textContent,
    current: document.querySelector('#currentPanel').textContent,
    hours: document.querySelectorAll('#hourlyList li').length,
    days: document.querySelectorAll('#dailyList li').length,
    hourly: document.querySelector('#hourlyList').textContent,
    status: document.querySelector('#statusText').textContent,
    candidates: [...document.querySelectorAll('#cityResults button')].map(x => x.textContent),
    overflow: document.documentElement.scrollWidth > window.innerWidth
  }`);
  const search = query => evaluate(`document.querySelector('#cityQuery').value=${JSON.stringify(query)};
    document.querySelector('#cityForm').requestSubmit();`);
  const capture = async (filename, width) => {
    const height = await evaluate('return document.documentElement.scrollHeight');
    const screenshot = await cdp('Page.captureScreenshot', {format: 'png',
      captureBeyondViewport: true, clip: {x: 0, y: 0, width, height, scale: 1}});
    await writeFile(path.join(output, filename), Buffer.from(screenshot.data, 'base64'));
  };
  await cdp('Page.addScriptToEvaluateOnNewDocument', {source: fixture});
  await command('POST', route + '/url', {url: site});
  const initial = await waitFor(async () => {
    const s = await snapshot();
    return s.current.includes('23') && s.hours === 24 && s.days === 7 ? s : null;
  }, 'ordinary weather fixture');
  assert.equal(initial.city, '广州 · 广东');
  assert.equal(initial.overflow, false);
  await capture('ordinary-desktop.png', 1440);

  await search('Springfield');
  await waitFor(async () => (await snapshot()).candidates.length === 2, 'duplicate place results');
  await evaluate(`document.querySelectorAll('#cityResults button')[1].click()`);
  await waitFor(async () => {
    const s = await snapshot();
    return s.city === 'Springfield · B' && s.current.includes('28') && s.hours === 24;
  }, 'selected second place');

  await evaluate(`window.__ordinaryFixture.holdSearch=true`);
  await search('slow');
  await waitFor(async () => evaluate('return Boolean(window.__ordinaryFixture.pendingSearch)'), 'old search held');
  await search('fast');
  await waitFor(async () => (await snapshot()).candidates[0]?.includes('New result'), 'new search');
  await evaluate(`window.__ordinaryFixture.releaseSearch()`);
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.deepEqual((await snapshot()).candidates.length, 1);
  assert.match((await snapshot()).candidates[0], /New result/);

  await search('Springfield');
  await waitFor(async () => (await snapshot()).candidates.length === 2, 'places before forecast race');
  await evaluate(`window.__ordinaryFixture.holdForecastLat=1;
    document.querySelectorAll('#cityResults button')[0].click()`);
  await waitFor(async () => evaluate('return Boolean(window.__ordinaryFixture.pendingForecast)'), 'old forecast held');
  await search('Springfield');
  await waitFor(async () => (await snapshot()).candidates.length === 2, 'new forecast candidates');
  await evaluate(`document.querySelectorAll('#cityResults button')[1].click()`);
  await waitFor(async () => (await snapshot()).current.includes('28'), 'new forecast');
  await evaluate(`window.__ordinaryFixture.releaseForecast()`);
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal((await snapshot()).city, 'Springfield · B');
  assert.match((await snapshot()).current, /28/);

  await evaluate(`window.__ordinaryFixture.mode='missing'; document.querySelector('#refreshBtn').click()`);
  await waitFor(async () => (await snapshot()).hourly.includes('降水 暂无数据'), 'missing precipitation');
  await evaluate(`window.__ordinaryFixture.mode='error'; document.querySelector('#refreshBtn').click()`);
  const failed = await waitFor(async () => {
    const s = await snapshot(); return s.status.includes('HTTP 503') ? s : null;
  }, 'provider failure');
  assert.equal(failed.current, '');
  assert.equal(failed.hours, 0);
  await evaluate(`window.__ordinaryFixture.mode='complete'; document.querySelector('#refreshBtn').click()`);
  await waitFor(async () => (await snapshot()).current.includes('28'), 'retry success');

  await cdp('Emulation.setDeviceMetricsOverride', {width: 390, height: 844,
    deviceScaleFactor: 1, mobile: true});
  assert.equal((await snapshot()).overflow, false);
  await capture('ordinary-mobile.png', 390);
  await cdp('Emulation.clearDeviceMetricsOverride');

  await evaluate(`localStorage.setItem('atmosscope-city','{broken')`);
  await command('POST', route + '/refresh', {});
  await waitFor(async () => (await snapshot()).city === '广州 · 广东', 'stored city fallback');
  await evaluate(`document.querySelector('a.atlas-link').click()`);
  await waitFor(async () => evaluate(`return location.pathname === '/index.html' &&
    Boolean(document.querySelector('a[href="ordinary.html"]'))`), 'local professional navigation');
  await evaluate(`document.querySelector('a[href="ordinary.html"]').click()`);
  await waitFor(async () => evaluate(`return location.pathname === '/ordinary.html' &&
    Boolean(document.querySelector('#cityForm'))`), 'local ordinary navigation');

  const live = await liveProvider();
  await writeFile(path.join(output, 'ordinary-provider.json'), JSON.stringify(live, null, 2));
  console.log('ORDINARY_SMOKE', JSON.stringify({initial, selected: 'Springfield · B',
    staleSearch: true, staleForecast: true, missing: true, retry: true, mobileOverflow: false}));
  console.log('ORDINARY_PROVIDER', JSON.stringify(live));
} finally {
  if (session) await command('DELETE', `/session/${session}`).catch(() => {});
  server.kill(); driver.kill();
}
