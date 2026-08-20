function level(value, thresholds){
  const n=Number(value)||0;
  return n>=thresholds.high?'strong':n>=thresholds.medium?'moderate':'weak';
}

export function diagnoseConsultation(input={}){
  const height=input.height500||{};
  const moisture=input.moisture850||{};
  const rain=input.precipitation24||0;

  const moistureState=level(moisture.magnitude,{medium:0,high:moisture.threshold??1});
  const rainState=level(rain,{medium:input.rainMedium??10,high:input.rainHigh??30});

  const factors=[];
  if(height.trough) factors.push('500 hPa低槽影响');
  if(moistureState!=='weak') factors.push('低层水汽输送增强');
  if(rainState!=='weak') factors.push('未来降水响应明显');

  let text='当前天气形势以常规模式场诊断为基础。';
  if(factors.length) text=`${factors.join('，')}，需关注相关天气影响。`;

  return {
    risk:rainState==='strong'&&moistureState!=='weak'?'较高':'一般',
    factors,
    text,
    method:'规则诊断 derived from model fields'
  };
}
