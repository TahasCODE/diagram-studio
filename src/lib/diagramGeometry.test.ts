import { describe,expect,it } from 'vitest';
import { placeConnectionLabel,routeConnection } from './diagramGeometry';
import type { Box } from './diagramGeometry';
describe('diagram presentation geometry',()=>{
  it('routes around a middle node with orthogonal segments and rounded corners',()=>{
    const from:Box={id:'a',x:60,y:100,width:80,height:50};
    const to:Box={id:'b',x:420,y:100,width:80,height:50};
    const obstacle:Box={id:'middle',x:240,y:100,width:100,height:70};
    const route=routeConnection(from,to,[from,obstacle,to]);
    expect(route.path).toContain('Q');expect(route.path).not.toMatch(/NaN|Infinity/);
    for(let i=1;i<route.points.length;i++){
      const a=route.points[i-1],b=route.points[i];
      expect(a.x===b.x||a.y===b.y).toBe(true);
      const crosses=a.x===b.x?a.x>190&&a.x<290&&Math.max(a.y,b.y)>65&&Math.min(a.y,b.y)<135:a.y>65&&a.y<135&&Math.max(a.x,b.x)>190&&Math.min(a.x,b.x)<290;
      expect(crosses).toBe(false);
    }
  });
  it('puts branch labels clear of node boxes and keeps backward routes finite',()=>{
    const from:Box={id:'a',x:420,y:180,width:120,height:72};
    const to:Box={id:'b',x:100,y:80,width:120,height:72};
    const route=routeConnection(from,to,[from,to]);
    const label=placeConnectionLabel(route.points,[from,to],120,{width:600,height:300},[]);
    expect(route.path).not.toMatch(/NaN|Infinity/);
    for(const node of [from,to])expect(Math.abs(label.x-node.x)<120&&Math.abs(label.y-node.y)<47).toBe(false);
  });
  it('keeps labels off closely spaced horizontal nodes',()=>{
    const from:Box={id:'a',x:180,y:200,width:160,height:72},to:Box={id:'b',x:390,y:200,width:160,height:72};
    const route=routeConnection(from,to,[from,to]);
    const label=placeConnectionLabel(route.points,[from,to],106,{width:600,height:400},[]);
    for(const node of [from,to])expect(Math.abs(label.x-node.x)<133&&Math.abs(label.y-node.y)<47).toBe(false);
  });
});
