import assert from 'node:assert/strict';
import test from 'node:test';
import * as summaryModule from '../web/consultation-summary.mjs';
const summarizeConsultation=summaryModule.summarizeConsultation;

test('the rule engine labels internal 10 and 30 mm thresholds',()=>{
  for(const [amount,risk] of [[0,'一般'],[10,'关注'],[30,'重点关注']]){
    const result=summarizeConsultation({rain24:[[amount,0],[0,0]],
      moistureMagnitude:[[1,1],[1,1]],coverage:{valid:4,total:4}});
    assert.equal(result.risk,risk);
    assert.match(result.text,/不是官方预警/);
  }
});

test('an incomplete grid provides only valid-point facts',()=>{
  const result=summarizeConsultation({rain24:[[0,30],[NaN,2]],
    moistureMagnitude:[[1,1],[NaN,1]],coverage:{valid:3,total:4}});
  assert.equal(result.risk,'未判定');
  assert.match(result.text,/有效采样点 3\/4/);
  assert.match(result.text,/有效点最大值 30 mm/);
  assert.deepEqual(result.factors,[]);
});
