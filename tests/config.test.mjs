import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Android shell opens the production origin as the fixed application ID", () => {
  const settings = read("android/settings.gradle.kts");
  const gradle = read("android/app/build.gradle.kts");
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  const strings = read("android/app/src/main/res/values/strings.xml");

  assert.match(settings, /rootProject\.name = "AtmosScopeAndroid"/);
  assert.match(gradle, /applicationId = "com\.atmosscope\.weather"/);
  assert.match(gradle, /minSdk = 24/);
  assert.match(gradle, /com\.google\.androidbrowserhelper:androidbrowserhelper:/);
  assert.match(manifest, /com\.google\.androidbrowserhelper\.trusted\.LauncherActivity/);
  assert.match(manifest, /android:autoVerify="true"/);
  assert.match(strings, /atmosscope-weather\.phillipchan520\.chatgpt\.site/);
});

test("Windows shell is self-contained and only trusts the production origin", () => {
  const project = read("windows/AtmosScope/AtmosScope.csproj");
  const window = read("windows/AtmosScope/MainWindow.xaml.cs");
  const installer = read("windows/installer/AtmosScope.iss");

  assert.match(project, /<TargetFramework>net8\.0-windows<\/TargetFramework>/);
  assert.match(project, /Microsoft\.Web\.WebView2/);
  assert.match(window, /https:\/\/atmosscope-weather\.phillipchan520\.chatgpt\.site/);
  assert.match(window, /NewWindowRequested/);
  assert.match(installer, /OutputBaseFilename=AtmosScope-Windows-Setup/);
  assert.match(installer, /ArchitecturesAllowed=x64compatible/);
});

test("release workflow builds signed Android and Windows artifacts with checksums", () => {
  const workflow = read(".github/workflows/release.yml");

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /version:/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /android:/);
  assert.match(workflow, /windows:/);
  assert.match(workflow, /release:/);
  assert.match(workflow, /ANDROID_KEYSTORE_BASE64/);
  assert.match(workflow, /ANDROID_KEYSTORE_PASSWORD/);
  assert.match(workflow, /ANDROID_KEY_ALIAS/);
  assert.match(workflow, /ANDROID_KEY_PASSWORD/);
  assert.match(workflow, /AtmosScope-Android\.apk/);
  assert.match(workflow, /AtmosScope-Windows-Setup\.exe/);
  assert.match(workflow, /SHA256SUMS\.txt/);
  assert.match(workflow, /gh release create/);
});
