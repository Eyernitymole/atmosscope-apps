export function sparseVectorPoints(qu,qv,step=2){
  const out=[];
  for(let r=0;r<qu.length;r+=step){
    for(let c=0;c<qu[r].length;c+=step){
      const u=Number(qu[r][c]),v=Number(qv[r][c]);
      if(Number.isFinite(u)&&Number.isFinite(v)) out.push({r,c,u,v,mag:Math.hypot(u,v)});
    }
  }
  return out;
}

export function addMoistureVectors(qu,qv){
  return sparseVectorPoints(qu,qv).map(p=>({
    ...p,
    className:'moisture-vector-arrow',
    angle:Math.atan2(p.v,p.u)*180/Math.PI
  }));
}

export function trailingPrecipitation(hourly,index){
  const p=hourly?.precipitation;
  if(!Array.isArray(p)) return 0;
  return p.slice(index,index+24).reduce((a,b)=>a+(Number(b)||0),0);
}

export function addHeightContours(field){
  return {type:'height-contours',field,derived:true};
}

export async function consultationComposite(fields){
  return {
    type:'consultation-composite',
    layers:{
      height500:addHeightContours(fields.geopotential_height_500hPa),
      moisture850:fields.moistureFlux850,
      precipitation:fields.precipitation
    },
    note:'500 hPa 高度场 + 850 hPa 水汽输送 + 降水响应，基于采样网格 derived 诊断。'
  };
}
