import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("professional atlas contains all six required products", () => {
  const html = read("web/index.html");
  const app = read("web/app.js");
  for (const label of ["天气雷达","模式云场","未来 72 小时累计降水","850 hPa 风场","500 hPa 高度与温度场","模式探空图"]) assert.match(html, new RegExp(label));
  assert.match(app, /api\.rainviewer\.com\/public\/weather-maps\.json/);
  assert.match(app, /api\.open-meteo\.com\/v1\/cma/);
  assert.match(app, /api\.open-meteo\.com\/v1\/ecmwf/);
  assert.match(app, /api\.open-meteo\.com\/v1\/gfs/);
  assert.match(app, /wind_speed_850hPa/);
  assert.match(app, /geopotential_height_500hPa/);
  assert.match(app, /relative_humidity_\$\{p\}hPa/);
});

test("Android exposes ordinary weather and bundled professional atlas", () => {
  const gradle = read("android/app/build.gradle.kts");
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  const activity = read("android/app/src/main/java/com/atmosscope/weather/MainActivity.java");
  assert.match(gradle, /applicationId = "com\.atmosscope\.weather"/);
  assert.match(gradle, /assets\.srcDir\(rootProject\.file\("\.\.\/web"\)\)/);
  assert.doesNotMatch(gradle, /androidbrowserhelper/);
  assert.match(manifest, /android:name="\.MainActivity"/);
  assert.match(activity, /普通天气/);
  assert.match(activity, /专业图集/);
  assert.match(activity, /file:\/\/\/android_asset\/index\.html/);
});

test("Windows exposes ordinary weather and bundled professional atlas", () => {
  const project = read("windows/AtmosScope/AtmosScope.csproj");
  const xaml = read("windows/AtmosScope/MainWindow.xaml");
  const window = read("windows/AtmosScope/MainWindow.xaml.cs");
  assert.match(project, /\.\.\\\.\.\\web\\\*\*\\\*/);
  assert.match(xaml, /普通天气/);
  assert.match(xaml, /专业图集/);
  assert.match(window, /app\.atmosscope\.local/);
  assert.match(window, /SetVirtualHostNameToFolderMapping/);
});

test("release workflow builds signed Android and Windows artifacts", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /\.release-version/);
  assert.match(workflow, /ANDROID_KEYSTORE_BASE64/);
  assert.match(workflow, /AtmosScope-Android\.apk/);
  assert.match(workflow, /AtmosScope-Windows-Setup\.exe/);
  assert.match(workflow, /SHA256SUMS\.txt/);
  assert.match(workflow, /gh release create/);
});
