// This rule is a sampled-grid screening aid, not an official weather warning.
export function summarizeConsultation({rain24,moistureMagnitude,coverage}){
  const values=rain24.flat().filter(Number.isFinite);
  if(!values.length||!moistureMagnitude.flat().some(Number.isFinite))
    return {risk:'未判定',factors:[],text:'数据不足',method:'采样网格 derived 诊断'};

  const maximum=Math.max(...values);
  if(coverage.valid!==coverage.total)
    return {risk:'未判定',factors:[],
      text:`有效采样点 ${coverage.valid}/${coverage.total}；有效点最大值 ${maximum} mm。`,
      method:'采样网格 derived 诊断；缺测时不分级'};

  const risk=maximum>=30?'重点关注':maximum>=10?'关注':'一般';
  return {risk,factors:['500 hPa高度场可用','850 hPa水汽输送图层可用'],
    text:`采样网格区域最大 24 小时降水 ${maximum} mm；10/30 mm 为 App 内部关注筛查线，不是官方预警。`,
    method:'真实模式字段 + 采样网格派生诊断'};
}
