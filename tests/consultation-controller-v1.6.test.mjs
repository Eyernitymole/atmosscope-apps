import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source=readFileSync(new URL('../web/consultation-controller.mjs', import.meta.url),'utf8');

test('consultation controller connects diagnosis and panel layers',()=>{
  assert.match(source,/diagnoseConsultation/);
  assert.match(source,/buildConsultationPanel/);
  assert.match(source,/createConsultationResult/);
});

test('consultation controller provides fallback for missing data',()=>{
  assert.match(source,/safeConsultation/);
  assert.match(source,/数据不足/);
  assert.match(source,/fallback/);
});
