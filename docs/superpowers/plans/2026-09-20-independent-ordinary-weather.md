# AtmosScope Independent Ordinary Weather Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ChatGPT Site dependency in the ordinary-weather entry with one locally packaged weather page shared by Web, Android and Windows, then release a verified v1.7.0.

**Architecture:** Add `web/ordinary.html` and focused data/UI modules alongside the existing `web/index.html` professional atlas. Both native wrappers load the bundled files through HTTPS virtual origins; Open-Meteo supplies model weather and city search without a new backend. Public hosting remains a separate deployment decision.

**Tech Stack:** HTML/CSS/ES modules, Node 24 built-in test runner, ChromeDriver smoke script, Android Java/WebViewAssetLoader (`androidx.webkit:webkit:1.17.0`), WPF WebView2, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-20-independent-ordinary-weather-design.md`

## Global Constraints

- Start an isolated implementation branch `agent/v1.7-independent-weather` from the committed design/plan branch; do not change the released `v1.6.0` tag or assets.
- Preserve the existing professional atlas at `web/index.html`, its product controls and the `59`-test baseline; no large atlas refactor.
- New ordinary weather offers city search with explicit duplicate selection, model current conditions, 24 future hours, seven days, sources and missing-data states. It never labels model data as observed station data or an official warning.
- No ChatGPT Site runtime URLs in `web/`, Android or Windows; no location permission, backend, frontend framework or new public deployment in this plan.
- Display times in the API-returned IANA `timezone`; hourly/current UNIX seconds are absolute instants. Never convert missing numeric values to zero.
- Android minSdk 24; AndroidX WebKit `1.17.0` is the stable release compatible with this floor ([official release notes](https://developer.android.com/jetpack/androidx/releases/webkit)).
- API provider: [Open-Meteo forecast](https://open-meteo.com/en/docs) and [geocoding](https://open-meteo.com/en/docs/geocoding-api). The [free API terms](https://open-meteo.com/en/terms) require noncommercial use and have rate limits; public hosting is deferred pending a usage decision.

## File Structure

| File | Responsibility |
| --- | --- |
| `web/ordinary-data.mjs` | Default city, geocoding validation, weather-code labels and pure forecast normalization. |
| `web/ordinary.html`, `web/ordinary.css` | Responsive ordinary-weather interface, accessible status, three forecast sections and local atlas link. |
| `web/ordinary.mjs` | API requests, selection, latest-request ownership, local storage and text-only rendering. |
| `web/index.html` | Add a link to the ordinary page without changing atlas logic. |
| `android/app/src/main/java/com/atmosscope/weather/MainActivity.java`, `android/app/build.gradle.kts`, `android/app/src/main/res/values/strings.xml` | Secure local HTTPS assets and remove old Site config. |
| `windows/AtmosScope/MainWindow.xaml.cs`, `windows/AtmosScope/MainWindow.xaml` | Point both buttons to bundled pages and restrict navigation. |
| `tests/ordinary-data.test.mjs`, `tests/ordinary-ui.test.mjs`, `tests/config.test.mjs` | Data behavior, UI request ownership and native-entry contracts. |
| `scripts/browser-smoke-ordinary.mjs`, `.github/workflows/ci.yml` | Browser acceptance with fixture plus live-field probe, Android debug/Windows PR build gates. |
| `README.md`, `.release-version`, `package.json`, `tests/release-config.test.mjs` | Explain independent runtime and stage the next version after PR acceptance. |

## Review Focus

The spec implies these additional user-facing risks; each is pinned to a task below.

1. A stored city contains out-of-range coordinates or malformed JSON: Task 2 falls back to Guangzhou without making a request to an arbitrary host.
2. One of two consecutive searches resolves last: Task 2 shows only the newer search's candidates.
3. The provider returns a valid hourly time but `null` precipitation or a short daily array: Task 1 preserves the missing value and Task 2 shows an explicit unavailable value.
4. The provider returns an invalid IANA time zone: Task 1 substitutes UTC and keeps valid hourly ordering.
5. A native page navigates to a `file:`, `intent:` or custom-scheme URL: Task 3/4 tests ensure the app does not load or launch that URI.

---

### Task 1: Parse truthful city and weather data

**Files:** Create `web/ordinary-data.mjs`; create `tests/ordinary-data.test.mjs`.

**Interfaces:** `DEFAULT_CITY={name,admin1,country,latitude,longitude}`; `normalizePlaces(payload): City[]`; `weatherLabel(code): string`; `normalizeForecast(payload,{nowMs}): {timeZone,updatedAt,current,hours,days}`. An absent field returns `null`; a missing array yields no forecast items rather than fabricated zero values. `current` may be null. Each hour has `{timestamp,temperature,weatherCode,precipitation,probability}`; each day has `{date,high,low,weatherCode,precipitation,probability}`.

- [ ] **Step 1: Write failing unit tests** in `tests/ordinary-data.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizePlaces,normalizeForecast,weatherLabel} from '../web/ordinary-data.mjs';

test('city results preserve duplicate names and reject invalid coordinates',()=>{
  const places=normalizePlaces({results:[
    {name:'Springfield',admin1:'A',country:'US',latitude:1,longitude:2},
    {name:'Springfield',admin1:'B',country:'US',latitude:3,longitude:4},
    {name:'Bad',latitude:91,longitude:1}]});
  assert.deepEqual(places.map(p=>p.admin1),['A','B']);
  assert.deepEqual(normalizePlaces({}),[]);
});
test('hourly window crosses midnight and missing rain is not zero',()=>{
  const base=1_780_000_000; // fixed test clock; actual UTC date is irrelevant
  const time=Array.from({length:50},(_,i)=>base-3600+i*3600);
  const rain=Array(50).fill(0);rain[2]=null;
  const forecast=normalizeForecast({timezone:'Asia/Shanghai',current:{time:base,temperature_2m:23},
    hourly:{time,temperature_2m:Array(50).fill(23),precipitation:rain},
    daily:{time:[Date.UTC(2026,8,19,16)/1000,Date.UTC(2026,8,20,16)/1000],
      temperature_2m_max:[29]}},{nowMs:base*1000});
  assert.equal(forecast.hours.length,24);
  assert.equal(forecast.hours[0].timestamp,base);
  assert.equal(forecast.hours[1].precipitation,null);
  assert.equal(forecast.days[1].high,null);
  assert.equal(forecast.days[0].date,'2026-09-20');
  assert.equal(weatherLabel(999),'未分类天气');
});
test('bad time zone and absent arrays yield safe empty values',()=>{
  const value=normalizeForecast({timezone:'Invalid/Zone',current:{temperature_2m:null}},
    {nowMs:1_780_000_000_000});
  assert.equal(value.timeZone,'UTC');
  assert.equal(value.current.temperature,null);
  assert.deepEqual(value.hours,[]);
  assert.deepEqual(value.days,[]);
});
```

- [ ] **Step 2: Run** `node --test tests/ordinary-data.test.mjs`; expect module-not-found/exports RED.
- [ ] **Step 3: Implement the pure functions** using numeric validation and stable array indexes:

```js
export const DEFAULT_CITY=Object.freeze({name:'广州',admin1:'广东',country:'中国',
  latitude:23.1291,longitude:113.2644});
const finite=v=>v===null||v===undefined||v===''?null:
  Number.isFinite(Number(v))?Number(v):null;
export function normalizePlaces(payload){
  return (Array.isArray(payload?.results)?payload.results:[])
    .filter(p=>typeof p?.name==='string'&&p.name.trim()&&
      finite(p.latitude)!==null&&Math.abs(finite(p.latitude))<=90&&
      finite(p.longitude)!==null&&Math.abs(finite(p.longitude))<=180)
    .slice(0,5).map(p=>({name:p.name,admin1:p.admin1||'',
      country:p.country||'',latitude:Number(p.latitude),longitude:Number(p.longitude)}));
}
const item=(a,i)=>Array.isArray(a)&&i<a.length?finite(a[i]):null;
function dayKey(seconds,timeZone){
  if(seconds===null)return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,
    year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(seconds*1000)
    .map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function weatherLabel(code){
  const n=finite(code);
  if(n===0)return '晴';
  if([1,2,3].includes(n))return '多云';
  if([45,48].includes(n))return '雾';
  if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(n))return '雨';
  if([71,73,75,77,85,86].includes(n))return '雪';
  if([95,96,99].includes(n))return '雷暴';
  return '未分类天气';
}
export function normalizeForecast(payload,{nowMs=Date.now()}={}){
  if(payload?.error)throw new Error(payload.reason||'数据源错误');
  let timeZone=payload?.timezone||'UTC';
  try{new Intl.DateTimeFormat('zh-CN',{timeZone}).format(0)}
  catch{timeZone='UTC'}
  const c=payload?.current;
  const current=c&&typeof c==='object'?{
    timestamp:finite(c.time),temperature:finite(c.temperature_2m),
    apparent:finite(c.apparent_temperature),humidity:finite(c.relative_humidity_2m),
    wind:finite(c.wind_speed_10m),weatherCode:finite(c.weather_code)}:null;
  const h=payload?.hourly||{};
  const hours=(Array.isArray(h.time)?h.time:[]).map((raw,i)=>({
    timestamp:finite(raw),temperature:item(h.temperature_2m,i),
    weatherCode:item(h.weather_code,i),precipitation:item(h.precipitation,i),
    probability:item(h.precipitation_probability,i)}))
    .filter(row=>row.timestamp!==null&&row.timestamp*1000>=nowMs)
    .sort((a,b)=>a.timestamp-b.timestamp).slice(0,24);
  const d=payload?.daily||{};
  const days=(Array.isArray(d.time)?d.time:[]).slice(0,7).map((date,i)=>({
    date:dayKey(finite(date),timeZone),high:item(d.temperature_2m_max,i),
    low:item(d.temperature_2m_min,i),weatherCode:item(d.weather_code,i),
    precipitation:item(d.precipitation_sum,i),
    probability:item(d.precipitation_probability_max,i)}));
  return {timeZone,updatedAt:current?.timestamp??null,current,hours,days};
}
```

- [ ] **Step 4: Run** `node --test tests/ordinary-data.test.mjs && npm test`; expect all tests GREEN. Add these assertions for values easy to misinterpret, then rerun targeted tests:

```js
assert.equal(normalizeForecast({hourly:{time:[base],precipitation:[0]}},
  {nowMs:base*1000}).hours[0].precipitation,0);
assert.deepEqual(normalizeForecast({daily:{time:[]}},
  {nowMs:base*1000}).days,[]);
assert.equal(weatherLabel(null),'未分类天气');
```
- [ ] **Step 5: Commit** `web/ordinary-data.mjs` and `tests/ordinary-data.test.mjs` as `feat: normalize ordinary weather model data`.

### Task 2: Build ordinary-weather page and request ownership

**Files:** Create `web/ordinary.html`, `web/ordinary.css`, `web/ordinary.mjs`; modify `web/index.html`; create `tests/ordinary-ui.test.mjs`.

**Interfaces:** Imports Task 1's `DEFAULT_CITY`, `normalizePlaces`, `normalizeForecast`, `weatherLabel`. Exports `isStoredCity(value): boolean` and `createRequestOwner(): {next(): {id,signal}, current(id): boolean}` from `web/ordinary.mjs` for direct behavior tests. The browser binds the DOM only when `document` exists, so Node can import these two functions.

- [ ] **Step 1: Write failing tests** in `tests/ordinary-ui.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {isStoredCity,createRequestOwner} from '../web/ordinary.mjs';
test('stored city rejects malformed fields and accepts valid location',()=>{
  assert.equal(isStoredCity(null),false);
  assert.equal(isStoredCity({name:'Bad',latitude:100,longitude:2}),false);
  assert.equal(isStoredCity({name:'广州',latitude:23.1291,longitude:113.2644}),true);
});
test('new request aborts and supersedes an old search',()=>{
  const owner=createRequestOwner(),first=owner.next(),second=owner.next();
  assert.equal(first.signal.aborted,true);
  assert.equal(owner.current(first.id),false);
  assert.equal(owner.current(second.id),true);
});
```

- [ ] **Step 2: Run** `node --test tests/ordinary-ui.test.mjs`; expect missing module RED.
- [ ] **Step 3: Create the page** with `lang="zh-CN"`, viewport meta, `ordinary.css`, `<script type="module" src="ordinary.mjs">` and this content skeleton; add `<a href="ordinary.html">普通天气</a>` to `web/index.html` topbar. CSS uses single-column below 720px, visible focus states, no remote fonts or icons, and horizontal scrolling only inside the 24-hour strip.

```html
<header><h1>天衡气象 · 普通天气</h1><a href="index.html">专业图集</a></header>
<form id="cityForm"><label for="cityQuery">搜索城市</label>
  <input id="cityQuery" type="search" required><button type="submit">搜索</button></form>
<div id="cityResults"></div><p id="statusText" role="status" aria-live="polite"></p>
<h2 id="cityName"></h2><p id="sourceText">Open-Meteo · 模式预报 · 仅供参考</p>
<p id="updatedAt"></p><p id="cityTimeZone"></p>
<section id="currentPanel" aria-label="模式当前场"></section>
<section aria-label="未来24小时"><h2>未来 24 小时</h2><ol id="hourlyList"></ol></section>
<section aria-label="未来7天"><h2>未来 7 天</h2><ol id="dailyList"></ol></section>
<button id="refreshBtn" type="button">重试或刷新</button>
```
- [ ] **Step 4: Implement `web/ordinary.mjs`** with explicit API parameters and ownership:

```js
import {DEFAULT_CITY,normalizePlaces,normalizeForecast,weatherLabel}
  from './ordinary-data.mjs';
export function isStoredCity(c){return typeof c?.name==='string'&&!!c.name.trim()&&
  Number.isFinite(c.latitude)&&Math.abs(c.latitude)<=90&&
  Number.isFinite(c.longitude)&&Math.abs(c.longitude)<=180}
export function createRequestOwner(){
  let generation=0,controller;
  return {next(){controller?.abort();controller=new AbortController();
    return {id:++generation,signal:controller.signal}},current(id){return id===generation}};
}
const forecastFields={
  current:'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
  hourly:'temperature_2m,weather_code,precipitation,precipitation_probability',
  daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max'
};
function forecastUrl(city){return 'https://api.open-meteo.com/v1/forecast?'+
  new URLSearchParams({latitude:String(city.latitude),longitude:String(city.longitude),
    ...forecastFields,forecast_days:'7',timezone:'auto',timeformat:'unixtime'});}
function placesUrl(query){return 'https://geocoding-api.open-meteo.com/v1/search?'+
  new URLSearchParams({name:query,count:'5',language:'zh',format:'json'});}
```

In browser-only `init()` use one owner for every search and city request; `next()` aborts previous work. Create `clearWeather()` that empties `currentPanel`, `hourlyList`, `dailyList`, and `updatedAt`, and `setStatus(message)` that writes only to `statusText.textContent`. Implement the ownership boundary as follows:

```js
const owner=createRequestOwner();
async function load(city){
  const {id,signal}=owner.next();
  clearWeather();setStatus('正在加载模式预报…');
  try{
    const response=await fetch(forecastUrl(city),{signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const model=normalizeForecast(await response.json());
    if(!owner.current(id))return;
    render(model,city);setStatus('模式预报已更新');
  }catch(error){if(owner.current(id)){
    clearWeather();setStatus(`预报获取失败：${error.message}`);
  }}
}
```

`render(model,city)` uses `document.createElement` and `textContent`: set `cityName` to `city.name + (city.admin1 ? ' · ' + city.admin1 : '')`, plus `cityTimeZone` and `updatedAt` (display `暂无数据` if null); create current, hourly and daily cards, writing `暂无数据` for null and `0` for zero. Format epoch timestamps with `Intl.DateTimeFormat('zh-CN',{timeZone:model.timeZone,hour:'2-digit',minute:'2-digit'})`; use the already normalized `daily.date` string rather than reparsing it as UTC. Search clears `cityResults`, obtains a fresh owner token, fetches `placesUrl(query)`, calls `normalizePlaces`, and creates one button per candidate with `textContent` showing `name` + `admin1` + `country`; click calls `load(selectedCity)` and saves that city inside `try{localStorage.setItem('atmosscope-city',JSON.stringify(selectedCity))}catch{}`. Read stored city with `try{const value=JSON.parse(localStorage.getItem('atmosscope-city'));if(isStoredCity(value))city=value}catch{}` and default to `DEFAULT_CITY`. Bind listeners only behind `if(typeof document!=='undefined') init();`.

- [ ] **Step 5: Run** `node --test tests/ordinary-ui.test.mjs && npm test`, `node --check web/ordinary.mjs` and `git diff --check`; expect GREEN. Task 5 exercises the actual DOM for an old forecast response resolving after a newer city request.
- [ ] **Step 6: Commit** the four `web/` files and `tests/ordinary-ui.test.mjs` as `feat: add standalone ordinary weather page`.

### Task 3: Package local pages securely on Android

**Files:** Modify `android/app/build.gradle.kts`, `android/app/src/main/java/com/atmosscope/weather/MainActivity.java`, `android/app/src/main/res/values/strings.xml`, `tests/config.test.mjs`.

**Interfaces:** `ORDINARY_HOME=https://appassets.androidplatform.net/assets/ordinary.html`, `PROFESSIONAL_HOME=https://appassets.androidplatform.net/assets/index.html`; both pass through AndroidX WebViewAssetLoader path `/assets/`. Task 2's relative ES modules/CSS load under that same origin.

- [ ] **Step 1: Change Android assertions first** in `tests/config.test.mjs`:

```js
const activity=read('android/app/src/main/java/com/atmosscope/weather/MainActivity.java');
const values=read('android/app/src/main/res/values/strings.xml');
assert.match(activity,/WebViewAssetLoader/);
assert.match(activity,/appassets\.androidplatform\.net\/assets\/ordinary\.html/);
assert.match(activity,/appassets\.androidplatform\.net\/assets\/index\.html/);
assert.doesNotMatch(activity,/setAllowUniversalAccessFromFileURLs\(true\)/);
assert.doesNotMatch(activity,/chatgpt\.site|file:\/\/\/android_asset/);
assert.doesNotMatch(values,/launch_url|asset_statements|chatgpt\.site/);
```

Replace the old `file:///android_asset/index.html` assertion. Add an assertion that `shouldOverrideUrlLoading` checks `http/https` before sending a URL to `Intent.ACTION_VIEW`.
- [ ] **Step 2: Run** `node --test tests/config.test.mjs`; expect Android-entry assertions RED.
- [ ] **Step 3: Add** `dependencies { implementation("androidx.webkit:webkit:1.17.0") }` to `android/app/build.gradle.kts`. In `MainActivity` use:

```java
private static final String ORIGIN="https://appassets.androidplatform.net";
private static final String ORDINARY_HOME=ORIGIN+"/assets/ordinary.html";
private static final String PROFESSIONAL_HOME=ORIGIN+"/assets/index.html";
final WebViewAssetLoader assets=new WebViewAssetLoader.Builder()
    .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
weatherView.setWebViewClient(new WebViewClient(){
  @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    return assets.shouldInterceptRequest(request.getUrl());
  }
  @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    Uri uri=request.getUrl(), local=Uri.parse(ORIGIN);
    if("https".equals(uri.getScheme())&&local.getHost().equals(uri.getHost())&&
        uri.getPath()!=null&&uri.getPath().startsWith("/assets/"))return false;
    if("https".equals(uri.getScheme())||"http".equals(uri.getScheme())){
      try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}
      catch(ActivityNotFoundException ignored){}
    }
    return true;
  }
});
```

Import `android.net.Uri`, `android.content.Intent`, `android.content.ActivityNotFoundException`, `android.webkit.WebResourceRequest`, `android.webkit.WebResourceResponse`, `androidx.webkit.WebViewAssetLoader`. Set `s.setAllowFileAccess(false)` and `s.setAllowUniversalAccessFromFileURLs(false)`; load the two exact HTTPS URLs above. Remove legacy TWA strings from `strings.xml`, keeping `app_name`.
- [ ] **Step 4: Run** `node --test tests/config.test.mjs` and `gradle --no-daemon -p android :app:assembleDebug` in an Android SDK/Gradle 8.13 environment; confirm debug APK includes `assets/ordinary.html` and `assets/index.html` via `unzip -l`. If no Android SDK is installed locally, use the same CI commands in Task 5 as the build proof.
- [ ] **Step 5: Commit** Android files and the updated `tests/config.test.mjs` as `feat: load both weather pages from Android assets`.

### Task 4: Point Windows to the bundled ordinary page

**Files:** Modify `windows/AtmosScope/MainWindow.xaml.cs`, `windows/AtmosScope/MainWindow.xaml`, `tests/config.test.mjs`.

**Interfaces:** Existing `app.atmosscope.local` maps installed `Web/` to HTTPS. `OrdinaryHome` becomes `https://app.atmosscope.local/ordinary.html`; `ProfessionalHome` remains `/index.html`.

- [ ] **Step 1: Add failing assertions** in `tests/config.test.mjs`:

```js
const window=read('windows/AtmosScope/MainWindow.xaml.cs');
assert.match(window,/app\.atmosscope\.local\/ordinary\.html/);
assert.match(window,/app\.atmosscope\.local\/index\.html/);
assert.doesNotMatch(window,/chatgpt\.site/);
assert.doesNotMatch(window,/OrdinaryHome\.Host/);
assert.match(window,/Uri\.UriSchemeHttps/);
```

- [ ] **Step 2: Run** `node --test tests/config.test.mjs`; expect Windows-entry assertions RED.
- [ ] **Step 3: Change** `OrdinaryHome` to the local `/ordinary.html`; replace the outdated `MainWindow.xaml` explanatory label with “普通天气与专业图集均为应用内页面 · 预报需要联网”. Keep the original `SetVirtualHostNameToFolderMapping` path and professional page unmodified. Restrict `IsTrusted` and external launching to explicit schemes:

```csharp
private static readonly Uri OrdinaryHome=new("https://app.atmosscope.local/ordinary.html");
private static bool IsTrusted(string uri)=>Uri.TryCreate(uri,UriKind.Absolute,out var target)
    && target.Scheme==Uri.UriSchemeHttps
    && target.Host.Equals(LocalHost,StringComparison.OrdinalIgnoreCase);
private static void OpenExternal(string uri)
{
    if(!Uri.TryCreate(uri,UriKind.Absolute,out var target))return;
    if(target.Scheme is not (Uri.UriSchemeHttp or Uri.UriSchemeHttps))return;
    Process.Start(new ProcessStartInfo(target.AbsoluteUri){UseShellExecute=true});
}
```

`NavigationStarting` and `NewWindowRequested` already call these helpers, so rejected `file:`, `intent:` and custom schemes are canceled without launching them.
- [ ] **Step 4: Run** `node --test tests/config.test.mjs` and `dotnet build windows/AtmosScope/AtmosScope.csproj -c Release -r win-x64`; if .NET is unavailable locally, require Task 5's Windows CI build result. Check `git diff --check`.
- [ ] **Step 5: Commit** Windows files and updated test as `feat: open bundled ordinary weather on Windows`.

### Task 5: Browser acceptance, PR compile gates and documentation

**Files:** Create `scripts/browser-smoke-ordinary.mjs`; modify `.github/workflows/ci.yml`, `README.md`; adjust `web/ordinary.*` only for failures discovered by meaningful browser checks.

**Interfaces:** The browser test uses the existing ChromeDriver W3C pattern in `scripts/browser-smoke-v1.6.mjs`; it serves `web/` at localhost, injects `fetch` fixtures for `geocoding-api.open-meteo.com` and `api.open-meteo.com`, writes screenshots and a JSON probe to `artifacts/ordinary-*`.

- [ ] **Step 1: Write the smoke script's assertions before relying on it as a gate.** Start the local HTTP server and ChromeDriver as the existing script does; install a CDP `Page.addScriptToEvaluateOnNewDocument` interceptor before loading `ordinary.html`. Fixture forecast contains `current`, 48 hourly UNIX timestamps crossing midnight and 7 UNIX `daily.time` values. Assert that `#currentPanel` shows model temperature, `#hourlyList` has 24 items, `#dailyList` has 7, and both local navigation links work. Search returns two same-name city results; click the second and assert its administrative area plus refreshed weather. Hold an old city search and an old forecast response pending while newer requests complete; resolve the old ones later, and assert neither overwrites the new candidate list or forecast. Set a fixture mode that returns `null` precipitation, and another that returns HTTP 503; check `暂无数据` and retry without showing the previous city's weather. At 390px viewport assert no document-wide horizontal overflow. Save one desktop and one mobile screenshot. Print an `ORDINARY_PROVIDER` JSON result from a real, time-limited Guangzhou `/v1/forecast` request with only field presence and lengths, keeping the fixture smoke deterministic. Use `try/finally` to close ChromeDriver and server as in `scripts/browser-smoke-v1.6.mjs`.

```js
const snapshot=()=>evaluate(`return {
  city:document.querySelector('#cityName').textContent,
  current:document.querySelector('#currentPanel').textContent,
  hours:document.querySelectorAll('#hourlyList li').length,
  days:document.querySelectorAll('#dailyList li').length,
  status:document.querySelector('#statusText').textContent,
  overflow:document.documentElement.scrollWidth>window.innerWidth
}`);
await waitFor(async()=>{
  const s=await snapshot();return s.current.includes('23')&&s.hours===24&&s.days===7;
},'ordinary weather fixture');
const s=await snapshot();assert.equal(s.overflow,false);
// After a newer city selection and the release of an older pending fetch:
assert.equal((await snapshot()).city,'Springfield · B');
// Before another reload, inject malformed JSON and reload: default city is used.
await evaluate(`localStorage.setItem('atmosscope-city','{broken')`);
await command('POST',route+'/refresh',{});
await waitFor(async()=>((await snapshot()).city==='广州 · 广东'),'stored city fallback');
```
- [ ] **Step 2: Run** the script locally when ChromeDriver exists; otherwise run it in CI and inspect its steps and screenshots. A failed assertion is RED; fix the relevant `ordinary.*` module and rerun until GREEN.
- [ ] **Step 3: Extend `.github/workflows/ci.yml`** after the existing v1.6 browser step:

```yaml
      - name: Open ordinary weather in Chrome
        timeout-minutes: 4
        run: node scripts/browser-smoke-ordinary.mjs
```

Add a separate `android-debug` job on `ubuntu-latest`: `actions/checkout@v4`, `actions/setup-java@v4` Temurin 17, `android-actions/setup-android@v4`, `sdkmanager "platforms;android-36" "build-tools;36.0.0"`, `gradle/actions/setup-gradle@v4` with Gradle 8.13, then `gradle --no-daemon -p android :app:assembleDebug`. Add a separate `windows-build` job on `windows-latest`: checkout, `actions/setup-dotnet@v4` with 8.0.x, then `dotnet build windows/AtmosScope/AtmosScope.csproj -c Release -r win-x64`. The Android job uses a debug APK and needs no release signing secrets. Ensure the ordinary screenshots are uploaded alongside the existing consultation screenshots with the existing `upload-artifact` step (which uses `artifacts/`).

```yaml
  android-debug:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: {distribution: temurin, java-version: '17'}
      - uses: android-actions/setup-android@v4
      - run: sdkmanager "platforms;android-36" "build-tools;36.0.0"
      - uses: gradle/actions/setup-gradle@v4
        with: {gradle-version: '8.13'}
      - run: gradle --no-daemon -p android :app:assembleDebug
  windows-build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: {dotnet-version: '8.0.x'}
      - run: dotnet build windows/AtmosScope/AtmosScope.csproj -c Release -r win-x64
```
- [ ] **Step 4: Update `README.md`** to say both pages are bundled; data loads from Open-Meteo, professional products use their respective real providers; include `python3 -m http.server --directory web 8765` and page URLs `/ordinary.html` and `/index.html`; explain no public deployment yet and the free API usage boundary. Remove all current-site dependency claims.
- [ ] **Step 5: Run** `npm test`, JS syntax check (`find web -maxdepth 1 -type f \( -name '*.js' -o -name '*.mjs' \) -print0 | xargs -0 -n1 node --check`), `git diff --check`.
- [ ] **Step 6: Commit** smoke, CI and README as `test: accept independent ordinary weather on all platforms`; push the implementation branch without force, open its PR against `main`, then inspect all three PR CI jobs and screenshot artifacts. A live API failure is logged as `unavailable` and does not mask deterministic fixture failure; investigate it before claiming live-provider acceptance.

### Task 6: Prepare v1.7.0 and publish only after verification

**Files:** Modify `.release-version`, `package.json`, `tests/release-config.test.mjs` and the release workflow's version-specific notes in `.github/workflows/release.yml`.

**Interfaces:** `.release-version` and `package.json.version` agree at `1.7.0`. The workflow remains tag guarded and writes `AtmosScope-Android.apk`, `AtmosScope-Windows-Setup.exe`, `SHA256SUMS.txt` for the new tag, leaving `v1.6.0` untouched.

- [ ] **Step 1: Write a failing test** in `tests/release-config.test.mjs` while retaining the equality assertion. Run `node --test tests/release-config.test.mjs` and observe RED.

```js
test('1.7.0 ships independent ordinary weather alongside the atlas',()=>{
  const version=readFileSync(new URL('../.release-version',import.meta.url),'utf8').trim();
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(version,'1.7.0');
  assert.equal(pkg.version,version);
  assert.match(workflow,/普通天气.*应用内/);
});
```
- [ ] **Step 2: Set** `.release-version` to `1.7.0` and `package.json` version to `1.7.0`; replace the old v1.6-only release note in `.github/workflows/release.yml` with `AtmosScope v1.7：普通天气在应用内加载，城市搜索、模式当前场、未来 24 小时和 7 天预报；专业图集保留 v1.6 的综合会商与原有产品。预报需要联网；尚未部署独立公开网址。` Keep signing, tag rejection and asset names unchanged. Run targeted test, `npm test`, syntax and `git diff --check`; expect GREEN.
- [ ] **Step 3: Commit** the version and workflow as `chore: prepare AtmosScope v1.7.0` and update the implementation PR. Verify the PR head SHA, `main`, absence of tag `v1.7.0`, and all CI jobs before merge. If tag exists or branch protection rejects, stop and inspect rather than overwrite.
- [ ] **Step 4: After successful PR merge**, inspect the main push workflow, both native build jobs, signed APK verification, GitHub Release and tag. Download `AtmosScope-Android.apk`, `AtmosScope-Windows-Setup.exe` and `SHA256SUMS.txt`; run `sha256sum --check SHA256SUMS.txt` and compare API asset digests. Do not claim v1.7 released if any job, asset, tag or checksum is missing. Record the final PR, Release and CI links and the fact that public site hosting still awaits its separate deployment decision.

## Overall Acceptance

The ordinary page works without ChatGPT login over a local static server, and both native buttons open bundled pages. The tests verify truthfulness for missing weather data, latest-request ownership, duplicate city selection and navigation; existing professional atlas tests and Chrome smoke remain green. A new signed release is only announced after both installer assets have been downloaded and their SHA256 values checked.
