function lerp(a,b,va,vb,level){
  const t=(level-va)/(vb-va);
  return {x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)};
}

export function marchingSquares(field, level){
  const lines=[];
  if(!Array.isArray(field)||field.length<2) return lines;
  for(let y=0;y<field.length-1;y++){
    for(let x=0;x<field[y].length-1;x++){
      const cells=[
        {x,y,v:field[y][x]},
        {x:x+1,y,v:field[y][x+1]},
        {x:x+1,y:y+1,v:field[y+1][x+1]},
        {x,y:y+1,v:field[y+1][x]}
      ];
      const edges=[];
      for(let i=0;i<4;i++){
        const a=cells[i],b=cells[(i+1)%4];
        if((a.v<level)!==(b.v<level)) edges.push(lerp(a,b,a.v,b.v,level));
      }
      if(edges.length===2) lines.push(edges);
    }
  }
  return lines;
}

export function detectHeightCenters(field){
  let max=-Infinity,min=Infinity,maxPos=null,minPos=null;
  for(let y=0;y<field.length;y++){
    for(let x=0;x<field[y].length;x++){
      if(field[y][x]>max){max=field[y][x];maxPos={x,y};}
      if(field[y][x]<min){min=field[y][x];minPos={x,y};}
    }
  }
  return {ridge:maxPos,trough:minPos};
}
