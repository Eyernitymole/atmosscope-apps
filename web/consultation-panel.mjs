export function buildConsultationPanel(summary={}){
  return {
    title:'综合天气会商',
    risk:summary.risk||'一般',
    factors:summary.factors||[],
    text:summary.text||'暂无诊断结果',
    method:summary.method||'rule based diagnosis'
  };
}

export function formatConsultationPanel(summary){
  const p=buildConsultationPanel(summary);
  return [
    p.title,
    `风险等级：${p.risk}`,
    `主要因素：${p.factors.join('、')||'无'}`,
    p.text,
    `诊断依据：${p.method}`
  ].join('\n');
}
