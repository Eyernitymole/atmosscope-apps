import { contourSegments } from './meteo.mjs';

export function renderHeightContourLayer(map,field,lats,lons,L){
  const layer=L.layerGroup();
  const values=field.flat().filter(Number.isFinite);
  if(!values.length) return layer;
  for(let level=Math.ceil(Math.min(...values)/60)*60;
      level<=Math.floor(Math.max(...values)/60)*60;level+=60){
    for(const points of contourSegments(field,lats,lons,level))
      L.polyline(points,{className:'height-contour-line'}).addTo(layer);
  }
  return layer;
}

export function renderMoistureVectorLayer(map, vectors, L){
  const layer=L.layerGroup();
  for(const p of vectors){
    const size=Math.max(8,Math.min(24,p.mag*2));
    const icon=L.divIcon({
      className:'moisture-vector-arrow',
      html:`<span style="display:block;transform:rotate(${p.angle}deg);font-size:${size}px">➜</span>`,
      iconSize:[size,size]
    });
    if(map && p.lat!==undefined && p.lon!==undefined){
      L.marker([p.lat,p.lon],{icon}).addTo(layer);
    }
  }
  return layer;
}

export function consultationLegend(){
  return {
    title:'综合会商',
    items:[
      '500 hPa 位势高度等值线',
      '850 hPa 水汽输送矢量',
      '累计降水响应'
    ]
  };
}
