import { buildConsultationPanel } from './consultation-panel.mjs';
import { summarizeConsultation } from './consultation-summary.mjs';

const fallback=reason=>({title:'综合天气会商',status:'fallback',
  message:'数据不足',reason:reason||'必需诊断字段缺失'});

export function diagnoseConsultation(input={}){
  if(input.status!=='ready') return fallback(input.reason);
  const {rain24,moistureMagnitude,coverage}=input;
  if(!Array.isArray(rain24)||!Array.isArray(moistureMagnitude)||
     !rain24.length||!rain24.every(Array.isArray)||
     !moistureMagnitude.every(Array.isArray)||
     !Number.isInteger(coverage?.valid)||!Number.isInteger(coverage?.total))
    return fallback('必需诊断字段缺失');

  const cols=rain24[0].length;
  if(cols<1||moistureMagnitude.length!==rain24.length||
     rain24.some(row=>row.length!==cols)||
     moistureMagnitude.some(row=>row.length!==cols)||
     coverage.total!==rain24.length*cols||coverage.valid<1||
     coverage.valid>coverage.total)
    return fallback('有效点数与网格不一致');

  let valid=0;
  for(let row=0;row<rain24.length;row++) for(let col=0;col<cols;col++){
    if(Number.isFinite(rain24[row][col])&&
       Number.isFinite(moistureMagnitude[row][col])) valid++;
  }
  if(valid!==coverage.valid) return fallback('有效点数与网格不一致');
  return buildConsultationPanel(summarizeConsultation({rain24,moistureMagnitude,coverage}));
}

export function createConsultationResult(input={}){
  return diagnoseConsultation(input);
}

export function safeConsultation(input={}){
  try {return diagnoseConsultation(input)}
  catch(error){return fallback(error.message)}
}
