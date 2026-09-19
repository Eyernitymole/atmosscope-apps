const FIELDS = [
  'geopotential_height_500hPa',
  'temperature_850hPa',
  'relative_humidity_850hPa',
  'wind_speed_850hPa',
  'wind_direction_850hPa',
  'precipitation'
];
const GRID_FIELDS = ['height500','temp850','rh850','speed850','dir850','rain24'];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const fail = (reason,missing=[]) => ({status:'insufficient',reason,missing});

// The request asks Open-Meteo for GMT; its hourly strings may omit a UTC suffix.
function utcTime(value){
  if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return NaN;
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
}

export function buildConsultationData(res,lats,lons,index,accumulate24){
  const rows=lats?.length,cols=lons?.length,total=rows*cols;
  if(!Array.isArray(res)||!Array.isArray(lats)||!Array.isArray(lons)||
     rows<2||cols<2||res.length!==total) return fail('采样网格点数不一致');
  if(!Number.isInteger(index)||index<0) return fail('预报时效无效');

  const missing=FIELDS.filter(key=>res.every(point=>!Array.isArray(point?.hourly?.[key])));
  if(missing.length) return fail('模式字段不可用',missing);

  const startMs=utcTime(res[0]?.hourly?.time?.[index]);
  if(!Number.isFinite(startMs) ||
     res.some(point=>utcTime(point?.hourly?.time?.[index])!==startMs))
    return fail('预报时刻缺失或错位');
  if(res.every(point=>(point?.hourly?.precipitation?.length||0)<index+24))
    return fail('完整 24 小时预报时段不足');
  for(let hour=0;hour<24;hour++){
    if(res.some(point=>utcTime(point?.hourly?.time?.[index+hour])!==startMs+hour*3600000))
      return fail('24 小时预报时间轴不连续或错位');
  }

  const grid=Object.fromEntries(GRID_FIELDS.map(name=>[name,[]]));
  const mask=[];
  let valid=0;
  for(let row=0;row<rows;row++){
    mask[row]=[];
    for(const name of GRID_FIELDS) grid[name][row]=[];
    for(let col=0;col<cols;col++){
      const hourly=res[row*cols+col]?.hourly;
      const values=FIELDS.slice(0,5).map(key=>hourly?.[key]?.[index]);
      const rainHours=hourly?.precipitation?.slice(index,index+24);
      const complete=values.every(finite)&&Array.isArray(rainHours)&&
        rainHours.length===24&&rainHours.every(value=>finite(value)&&value>=0)&&
        values[2]>=0&&values[2]<=100&&values[3]>=0&&
        values[4]>=0&&values[4]<=360;
      const rain=complete?accumulate24(hourly,index):NaN;
      mask[row][col]=complete&&finite(rain)&&rain>=0;
      if(mask[row][col]) valid++;
      const cell=mask[row][col]?[...values,rain]:Array(6).fill(NaN);
      GRID_FIELDS.forEach((name,i)=>grid[name][row][col]=cell[i]);
    }
  }
  let hasCell=false;
  for(let row=0;row<rows-1;row++) for(let col=0;col<cols-1;col++)
    hasCell ||= mask[row][col]&&mask[row+1][col]&&
      mask[row][col+1]&&mask[row+1][col+1];
  if(!hasCell) return fail('有效网格不足以绘制组合图');

  return {status:'ready',grid,coverage:{valid,total},time:{
    start:new Date(startMs).toISOString(),
    end:new Date(startMs+24*3600000).toISOString()
  }};
}
