import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { diagnoseConsultation, safeConsultation } from '../web/consultation-controller.mjs';

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

test('complete fields give only a labeled internal screening grade',()=>{
  const panel=diagnoseConsultation({status:'ready',rain24:[[0,12],[30,4]],
    moistureMagnitude:[[2,3],[4,5]],coverage:{valid:4,total:4}});
  assert.equal(panel.risk,'重点关注');
  assert.match(panel.text,/30 mm/);
  assert.match(panel.text,/不是官方预警/);
});

test('partial coverage reports facts without a risk grade',()=>{
  const panel=diagnoseConsultation({status:'ready',rain24:[[0,12],[30,NaN]],
    moistureMagnitude:[[2,3],[4,NaN]],coverage:{valid:3,total:4}});
  assert.equal(panel.risk,'未判定');
  assert.match(panel.text,/3\/4/);
  assert.doesNotMatch(panel.text,/采样网格区域最大/);
});

test('rejected data preserves its shortage reason',()=>{
  const panel=diagnoseConsultation({status:'insufficient',reason:'完整 24 小时预报时段不足'});
  assert.equal(panel.status,'fallback');
  assert.match(panel.reason,/24 小时/);
});

test('measured dry weather is zero rather than missing',()=>{
  const panel=diagnoseConsultation({status:'ready',rain24:[[0,0],[0,0]],
    moistureMagnitude:[[0,0],[0,0]],coverage:{valid:4,total:4}});
  assert.equal(panel.risk,'一般');
  assert.match(panel.text,/0 mm/);
});

test('inconsistent coverage cannot claim a complete risk assessment',()=>{
  const panel=safeConsultation({status:'ready',rain24:[[10,NaN],[20,30]],
    moistureMagnitude:[[1,NaN],[1,1]],coverage:{valid:4,total:4}});
  assert.equal(panel.status,'fallback');
  assert.equal(panel.message,'数据不足');
  assert.match(panel.reason,/有效点数与网格不一致/);
});
