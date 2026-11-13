import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Diagram } from '../lib/model';
import { CANVAS_UI as UI, placeConnectionLabel, routeConnection } from '../lib/diagramGeometry';
import type { Box } from '../lib/diagramGeometry';
import { Icon } from './Icon';
interface Props {
  document:Diagram; scenario:number; step:number; selected?:string; readOnly:boolean;
  onSelect:(id:string)=>void; onChange:(document:Diagram)=>void;
  onUndo:()=>void; onRedo:()=>void; canUndo:boolean; canRedo:boolean;
}
export function Canvas(props:Props){
  const board=useRef<HTMLDivElement>(null);
  const [viewport,setSize]=useState({width:900,height:600});
  const size={width:Math.max(viewport.width,UI.minPlaneWidth),height:viewport.height};
  const [position,setPosition]=useState<{id:string;x:number;y:number}|null>(null);
  const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0});
  const [panning,setPanning]=useState(false);
  const panDrag=useRef<{x:number;y:number;startX:number;startY:number}|null>(null);
  const drag=useRef<{id:string;startX:number;startY:number;x:number;y:number;moved:boolean}|null>(null);
  useEffect(()=>{const observer=new ResizeObserver(entries=>{const bounds=entries[0].contentRect;setSize({width:Math.max(1,bounds.width),height:Math.max(1,bounds.height)});});if(board.current)observer.observe(board.current);return()=>observer.disconnect();},[]);
  const nodeWidth=Math.min(UI.nodeWidth,Math.max(UI.nodeMinWidth,size.width*UI.nodeRatio));
  const nodeHeight=viewport.width<500?UI.mobileNodeHeight:UI.nodeHeight;
  const nodes=useMemo(()=>position?props.document.nodes.map(n=>position.id===n.id?{...n,x:position.x,y:position.y}:n):props.document.nodes,[props.document.nodes,position]);
  const path=props.document.scenarios[props.scenario]?.steps||[];
  useEffect(()=>{
    if(viewport.width>=size.width||zoom!==1)return;
    const current=props.document.nodes.find(n=>n.id===path[props.step]);
    if(current)setPan({x:Math.min(0,Math.max(viewport.width-size.width,viewport.width/2-current.x*size.width/100)),y:0});
  },[props.step,props.scenario,viewport.width]);
  const changeZoom=(next:number)=>{
    setPan(p=>({x:viewport.width/2-(viewport.width/2-p.x)*next/zoom,y:viewport.height/2-(viewport.height/2-p.y)*next/zoom}));setZoom(next);
  };
  const graph=useMemo(()=>{
    const edges=new Map<string,{from:string;to:string;scenarios:string[]}>();
    for(const scenario of props.document.scenarios)for(let i=1;i<scenario.steps.length;i++){
      const from=scenario.steps[i-1],to=scenario.steps[i];if(from===to)continue;
      const key=JSON.stringify([from,to]);const edge=edges.get(key)||{from,to,scenarios:[]};
      if(!edge.scenarios.includes(scenario.name))edge.scenarios.push(scenario.name);edges.set(key,edge);
    }
    const outgoing=new Map<string,Set<string>>(),incoming=new Set<string>();
    for(const edge of edges.values()){if(!outgoing.has(edge.from))outgoing.set(edge.from,new Set());outgoing.get(edge.from)!.add(edge.to);incoming.add(edge.to);}
    return {edges,outgoing,incoming};
  },[props.document.scenarios]);
  const boxes:Box[]=useMemo(()=>nodes.map(n=>({id:n.id,x:n.x*size.width/100,y:n.y*size.height/100,width:nodeWidth,height:nodeHeight})),[nodes,size.width,size.height,nodeWidth,nodeHeight]);
  const activeEdges=new Set(path.slice(1,props.step+1).map((to,i)=>JSON.stringify([path[i],to])));
  // Playback changes path highlighting, not geometry. Re-route only when the
  // graph, node positions or viewport changes (including during a node drag).
  const routes=useMemo(()=>{
    const byId=new Map(boxes.map(b=>[b.id,b]));
    return [...graph.edges].map(([key,edge],index)=>({key,edge,...routeConnection(byId.get(edge.from)!,byId.get(edge.to)!,boxes,index)}));
  },[graph,boxes]);
  const labels=useMemo(()=>{
    const occupiedLabels:Box[]=[];
    return routes.filter(route=>(graph.outgoing.get(route.edge.from)?.size||0)>1).map(route=>{
      const label=route.edge.scenarios[0],text=label.length>23?label.slice(0,22)+'…':label,width=text.length*6+16;
      const point=placeConnectionLabel(route.points,boxes,width,size,occupiedLabels);
      occupiedLabels.push({id:route.key,...point,width,height:22});return {...route,text,width,...point};
    });
  },[routes,graph,boxes,size.width,size.height]);
  const fit=()=>{
    if(!boxes.length){setZoom(1);setPan({x:0,y:0});return;}
    const left=Math.min(...boxes.map(b=>b.x-b.width/2)),right=Math.max(...boxes.map(b=>b.x+b.width/2));
    const top=Math.min(...boxes.map(b=>b.y-b.height/2)),bottom=Math.max(...boxes.map(b=>b.y+b.height/2));
    const next=Math.max(UI.minZoom,Math.min(1.5,(viewport.width-UI.fitPadding)/(right-left),(viewport.height-UI.fitPadding)/(bottom-top)));
    setZoom(next);setPan({x:viewport.width/2-(left+right)/2*next,y:viewport.height/2-(top+bottom)/2*next});
  };
  return <section className="board" aria-label="Diagram" data-compact={viewport.width<600} style={{'--node-width':nodeWidth+'px','--node-height':nodeHeight+'px'} as CSSProperties}>
    <div className="canvas-toolbar"><span className="canvas-title"><Icon name="diagram" size={16}/>System Diagram</span><div className="canvas-tools">
      {!props.readOnly&&<div className="tool-group history-buttons"><button id="undo" aria-label="Undo" disabled={!props.canUndo} onClick={props.onUndo} title="Undo (Ctrl/Cmd+Z)"><Icon name="undo" size={16}/></button><button id="redo" aria-label="Redo" disabled={!props.canRedo} onClick={props.onRedo} title="Redo (Ctrl/Cmd+Shift+Z)"><Icon name="redo" size={16}/></button></div>}
      <div className="tool-group"><button aria-label="Zoom Out" title="Zoom out" disabled={zoom<=UI.minZoom} onClick={()=>changeZoom(Math.max(UI.minZoom,zoom-UI.zoomStep))}><Icon name="minus" size={16}/></button><button className="canvas-scale" aria-label="Reset Zoom" title="Reset zoom to 100%" onClick={()=>{setZoom(1);setPan({x:0,y:0});}}>{Math.round(zoom*100)}%</button><button aria-label="Zoom In" title="Zoom in" disabled={zoom>=UI.maxZoom} onClick={()=>changeZoom(Math.min(UI.maxZoom,zoom+UI.zoomStep))}><Icon name="plus" size={16}/></button><span className="tool-divider"/><button aria-label="Fit Diagram" title="Fit diagram to view" onClick={fit}><Icon name="fit" size={16}/></button></div>
    </div></div>
    <div ref={board} className={'diagram-stage'+(panning?' is-panning':'')} aria-label="Diagram Viewport" onPointerDown={event=>{if(event.button!==0||(event.target as HTMLElement).closest('button'))return;event.currentTarget.setPointerCapture(event.pointerId);panDrag.current={startX:event.clientX,startY:event.clientY,...pan};setPanning(true);}} onPointerMove={event=>{if(panDrag.current)setPan({x:panDrag.current.x+event.clientX-panDrag.current.startX,y:panDrag.current.y+event.clientY-panDrag.current.startY});}} onPointerUp={event=>{panDrag.current=null;setPanning(false);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={()=>{panDrag.current=null;setPanning(false);}}>
      <div className="diagram-plane" style={{width:size.width,height:size.height,transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}}>
        <svg id="edges" aria-hidden="true"><defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1 7 4 1 7" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs><g id="lines">{routes.map(route=><path key={route.key} d={route.path} className={activeEdges.has(route.key)?'active-edge':''}/>)}</g>
          {labels.map(label=><g key={label.key} className="edge-label" transform={`translate(${label.x},${label.y})`}><title>{label.edge.scenarios.join(', ')}</title><rect x={-label.width/2} y={-11} width={label.width} height={22} rx={8}/><text>{label.text}</text></g>)}
        </svg>
        <div id="nodes">{nodes.map(node=>{
          const current=path[props.step]===node.id,selected=!props.readOnly&&props.selected===node.id;
          const outgoing=graph.outgoing.get(node.id)?.size||0;
          const type=outgoing>1?'decision':!graph.incoming.has(node.id)&&outgoing?'start':!outgoing&&graph.incoming.has(node.id)?'end':'process';
          return <button key={node.id} type="button" aria-label={node.label} title={node.label+' · '+type+' node'} className={'node'+(current?' active':'')+(selected?' selected':'')+(position?.id===node.id?' is-dragging':'')} style={{left:node.x+'%',top:node.y+'%'}} disabled={props.readOnly} aria-pressed={!props.readOnly?selected:undefined}
            onClick={()=>{if(!drag.current?.moved)props.onSelect(node.id);}}
            onPointerDown={event=>{if(event.button!==0||props.readOnly)return;event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:node.id,startX:event.clientX,startY:event.clientY,x:node.x,y:node.y,moved:false};}}
            onPointerMove={event=>{const start=drag.current;if(!start||start.id!==node.id||!event.currentTarget.hasPointerCapture(event.pointerId))return;const dx=(event.clientX-start.startX)/zoom,dy=(event.clientY-start.startY)/zoom;if(!start.moved&&Math.hypot(dx,dy)<UI.dragThreshold)return;start.moved=true;const marginX=nodeWidth/2/size.width*100,marginY=nodeHeight/2/size.height*100;setPosition({id:node.id,x:Math.max(marginX,Math.min(100-marginX,start.x+dx*100/size.width)),y:Math.max(marginY,Math.min(100-marginY,start.y+dy*100/size.height))});}}
            onPointerUp={event=>{if(drag.current?.id!==node.id)return;if(drag.current.moved&&position){props.onChange({...props.document,nodes:props.document.nodes.map(n=>n.id===node.id?{...n,x:position.x,y:position.y}:n)});props.onSelect(node.id);}if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);setPosition(null);}}
            onPointerCancel={()=>{drag.current=null;setPosition(null);}}>
            <span className={'node-type '+type} aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">{type==='decision'?<path d="m8 2 6 6-6 6-6-6Z"/>:type==='start'?<path d="m6 4 6 4-6 4Z"/>:type==='end'?<><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></>:<rect x="3" y="3" width="10" height="10" rx="2"/>}</svg></span>
            <span className="node-label">{node.label}</span>{current&&<i className="current-dot" aria-hidden="true"/>}{selected&&Array.from({length:4},(_,i)=><i key={i} className="selection-handle" aria-hidden="true"/>)}
          </button>;
        })}</div>
      </div>
    </div>
    {!nodes.length&&<div className="empty-canvas"><strong>Your next explanation starts here.</strong><p>Add a node, then build a scenario.</p></div>}
    <div className="canvas-legend"><span><i className="legend-active"/>Current step</span>{!props.readOnly&&<span><i className="legend-selected"/>Selected node</span>}</div>
    {!!nodes.length&&<button className="minimap" aria-label="Fit Diagram from Minimap" title="Diagram overview · Click to fit" onClick={fit}><svg viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">{routes.map(route=><path key={route.key} d={route.path} fill="none" stroke="var(--edge)" strokeWidth="4"/>)}{boxes.map(box=><rect key={box.id} className={'minimap-node'+(path[props.step]===box.id?' current':'')} x={box.x-box.width/2} y={box.y-box.height/2} width={box.width} height={box.height} rx={12}/>)}<rect className="minimap-viewport" x={-pan.x/zoom} y={-pan.y/zoom} width={viewport.width/zoom} height={viewport.height/zoom} rx={8}/></svg></button>}
    {viewport.width+UI.fitPadding<size.width&&<span className="canvas-pan-hint">Drag to pan · Fit to see all</span>}
  </section>;
}
