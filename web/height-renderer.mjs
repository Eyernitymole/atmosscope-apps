export function renderHeightContours(map, contours, L){
  const layer=L.layerGroup();
  for(const line of contours||[]){
    const points=line.map(p=>[p.lat??p.y,p.lon??p.x]);
    if(points.length>1){
      L.polyline(points,{className:'height-contour-line'}).addTo(layer);
    }
  }
  return layer;
}

export function renderHeightCenters(map, centers, L){
  const layer=L.layerGroup();
  for(const item of [
    {pos:centers?.ridge,label:'高压脊候选'},
    {pos:centers?.trough,label:'低槽候选'}
  ]){
    if(item.pos){
      L.marker([item.pos.y,item.pos.x],{title:item.label}).addTo(layer);
    }
  }
  return layer;
}
