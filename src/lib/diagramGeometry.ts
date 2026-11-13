export interface Point { x:number; y:number }
export interface Box extends Point { id:string; width:number; height:number }
export const CANVAS_UI={nodeWidth:160,nodeMinWidth:88,nodeHeight:72,mobileNodeHeight:88,nodeRatio:.2,minPlaneWidth:560,portGap:12,corner:10,zoomStep:.1,minZoom:.5,maxZoom:2,dragThreshold:4,fitPadding:32};
const segmentHits=(a:Point,b:Point,box:Box)=>{
  const pad=8,left=box.x-box.width/2-pad,right=box.x+box.width/2+pad,top=box.y-box.height/2-pad,bottom=box.y+box.height/2+pad;
  return a.x===b.x?a.x>left&&a.x<right&&Math.max(a.y,b.y)>top&&Math.min(a.y,b.y)<bottom:a.y>top&&a.y<bottom&&Math.max(a.x,b.x)>left&&Math.min(a.x,b.x)<right;
};
export function roundedPath(points:Point[]){
  const unique=points.filter((p,i)=>!i||p.x!==points[i-1].x||p.y!==points[i-1].y);
  if(!unique.length)return '';
  let path=`M ${unique[0].x} ${unique[0].y}`;
  for(let i=1;i<unique.length-1;i++){
    const before=unique[i-1],at=unique[i],after=unique[i+1];
    const first=Math.hypot(at.x-before.x,at.y-before.y),second=Math.hypot(after.x-at.x,after.y-at.y);
    const radius=Math.min(CANVAS_UI.corner,first/2,second/2);
    const incoming={x:at.x-(at.x-before.x)/first*radius,y:at.y-(at.y-before.y)/first*radius};
    const outgoing={x:at.x+(after.x-at.x)/second*radius,y:at.y+(after.y-at.y)/second*radius};
    path+=` L ${incoming.x} ${incoming.y} Q ${at.x} ${at.y} ${outgoing.x} ${outgoing.y}`;
  }
  const last=unique.at(-1)!;return path+` L ${last.x} ${last.y}`;
}
export function routeConnection(from:Box,to:Box,boxes:Box[],lane=0){
  const gap=CANVAS_UI.portGap+lane%3*6;
  const right={x:from.x+from.width/2+2,y:from.y},left={x:to.x-to.width/2-5,y:to.y};
  const mid=(right.x+left.x)/2;
  const top=Math.min(...boxes.map(b=>b.y-b.height/2))-gap;
  const bottom=Math.max(...boxes.map(b=>b.y+b.height/2))+gap;
  const candidates:Point[][]=[];
  if(left.x>=right.x){
    candidates.push([right,{x:mid,y:right.y},{x:mid,y:left.y},left]);
    for(const y of [top,bottom,(from.y+to.y)/2])candidates.push([right,{x:right.x+gap,y:right.y},{x:right.x+gap,y},{x:left.x-gap,y},{x:left.x-gap,y:left.y},left]);
  }
  for(const side of [-1,1]){
    const start={x:from.x,y:from.y+side*(from.height/2+2)},end={x:to.x,y:to.y+side*(to.height/2+5)};
    const y=side<0?top:bottom;
    candidates.push([start,{x:start.x,y},{x:end.x,y},end]);
  }
  if(Math.abs(to.y-from.y)>from.height+gap){
    const side=to.y>from.y?1:-1,start={x:from.x,y:from.y+side*(from.height/2+2)},end={x:to.x,y:to.y-side*(to.height/2+5)},y=(start.y+end.y)/2;
    candidates.push([start,{x:start.x,y},{x:end.x,y},end]);
  }
  const obstacles=boxes.filter(b=>b.id!==from.id&&b.id!==to.id);
  const score=(points:Point[])=>points.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y)+obstacles.filter(b=>segmentHits(points[i],p,b)).length*100000,points.length*8);
  const points=candidates.sort((a,b)=>score(a)-score(b))[0];
  const segments=points.slice(1).map((p,i)=>({a:points[i],b:p,length:Math.hypot(p.x-points[i].x,p.y-points[i].y)}));
  const horizontal=segments.filter(s=>s.a.y===s.b.y&&s.length>48);
  const labelSegment=horizontal.at(-1)||segments.sort((a,b)=>b.length-a.length)[0];
  return {path:roundedPath(points),points,label:{x:(labelSegment.a.x+labelSegment.b.x)/2,y:(labelSegment.a.y+labelSegment.b.y)/2}};
}
export function placeConnectionLabel(points:Point[],boxes:Box[],width:number,size:{width:number;height:number},used:Box[]){
  const candidates:Point[]=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],x=(a.x+b.x)/2,y=(a.y+b.y)/2;
    if(Math.hypot(a.x-b.x,a.y-b.y)<1)continue;
    if(a.y===b.y){const clearance=Math.max(...boxes.map(box=>box.height))/2+24;candidates.push({x,y:y-16},{x,y:y+16},{x,y:y-clearance},{x,y:y+clearance});}
    else candidates.push({x:x-width/2-12,y},{x:x+width/2+12,y});
  }
  const score=(p:Point)=>[...boxes,...used].filter(b=>Math.abs(p.x-b.x)<(width+b.width)/2+8&&Math.abs(p.y-b.y)<(22+b.height)/2+8).length*10000+(p.x-width/2<0||p.x+width/2>size.width||p.y<12||p.y>size.height-12?1000:0);
  return candidates.sort((a,b)=>score(a)-score(b))[0]||points[0];
}
