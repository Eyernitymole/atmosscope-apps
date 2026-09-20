import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");

test("release workflow resolves automatic versions from .release-version", () => {
  assert.match(workflow, /FILE_VERSION=.*\.release-version/);
  assert.match(workflow, /VERSION="\$\{INPUT_VERSION:-\$FILE_VERSION\}"/);
  assert.match(workflow, /APP_VERSION: \$\{\{ needs\.version\.outputs\.value \}\}/);
  assert.match(workflow, /VERSION: \$\{\{ needs\.version\.outputs\.value \}\}/);
  assert.doesNotMatch(workflow, /inputs\.version \|\| '1\.1\.0'/);
});

test("release workflow retriggers for workflow or test fixes and duplicate tags fail early", () => {
  assert.match(workflow, /- \.github\/workflows\/release\.yml/);
  assert.match(workflow, /- tests\/\*\*/);
  assert.match(workflow, /git ls-remote --exit-code --tags origin "refs\/tags\/v\$VERSION"/);
});

test('1.7.1 ships independent ordinary weather and the Windows startup fix',()=>{
  const file=readFileSync(new URL('../.release-version',import.meta.url),'utf8').trim();
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(file,'1.7.1');
  assert.equal(pkg.version,file);
  assert.match(workflow,/普通天气.*应用内/);
});
