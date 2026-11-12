import { useEffect, useRef, useState } from 'react';
import type { Diagram } from '../lib/model';
import { Icon } from './Icon';

interface Props {
  document: Diagram; scenario: number; step: number; selected?: string; readOnly: boolean;
  onSelect: (id: string) => void; onChange: (document: Diagram) => void;
  onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
}
export function Canvas(props: Props) {
  const board = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [position, setPosition] = useState<{id: string; x: number; y: number} | null>(null);
  const drag = useRef<{id: string; startX: number; startY: number; x: number; y: number; moved: boolean} | null>(null);
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const bounds = entries[0].contentRect;
      setSize({ width: bounds.width, height: bounds.height });
    });
    if (board.current) observer.observe(board.current);
    return () => observer.disconnect();
  }, []);
  const nodes = props.document.nodes.map(n => position?.id === n.id ? { ...n, x: position.x, y: position.y } : n);
  const byId = new Map(nodes.map(n => [n.id, n]));
  const path = props.document.scenarios[props.scenario]?.steps || [];
  const edges = new Map<string, [string, string]>();
  for (const scenario of props.document.scenarios) for (let i = 1; i < scenario.steps.length; i++) {
    const from = scenario.steps[i-1], to = scenario.steps[i];
    if (from !== to) edges.set(JSON.stringify([from,to]), [from,to]);
  }
  return <section ref={board} className="board" aria-label="Diagram">
    <div className="canvas-toolbar"><span className="canvas-title"><Icon name="diagram" size={15}/>System Diagram</span><div className="canvas-tools">
      {!props.readOnly && <div className="actions history-buttons"><button id="undo" aria-label="Undo" disabled={!props.canUndo} onClick={props.onUndo} title="Undo (Ctrl/⌘ Z)"><Icon name="undo" size={16}/></button><button id="redo" aria-label="Redo" disabled={!props.canRedo} onClick={props.onRedo} title="Redo (Ctrl/⌘ Shift Z)"><Icon name="redo" size={16}/></button></div>}
      <span className="canvas-scale">100%</span>
    </div></div>
    <svg id="edges" aria-hidden="true"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="context-stroke"/></marker></defs><g id="lines">
      {[...edges].map(([key, [fromId, toId]]) => {
        const from = byId.get(fromId)!, to = byId.get(toId)!;
        const x = from.x * size.width / 100, y = from.y * size.height / 100;
        const dx = (to.x-from.x) * size.width / 100, dy = (to.y-from.y) * size.height / 100;
        if (Math.hypot(dx,dy) < 1) return null;
        const inset = Math.min(.45, Math.min(Math.min(size.width*.12,70)/Math.abs(dx),26/Math.abs(dy)));
        return <line key={key} x1={x+dx*inset} y1={y+dy*inset} x2={x+dx*(1-inset)} y2={y+dy*(1-inset)} className={fromId === path[props.step-1] && toId === path[props.step] ? 'active-edge' : ''}/>;
      })}
    </g></svg>
    <div id="nodes">
      {nodes.map(node => <button key={node.id} type="button"
        className={'node' + (path[props.step] === node.id ? ' active' : '') + (!props.readOnly && props.selected === node.id ? ' selected' : '')}
        style={{ left: node.x+'%', top: node.y+'%' }} disabled={props.readOnly}
        aria-pressed={!props.readOnly ? props.selected === node.id : undefined}
        onClick={() => { if (!drag.current?.moved) props.onSelect(node.id); }}
        onPointerDown={event => {
          if (event.button !== 0 || props.readOnly) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: node.id, startX: event.clientX, startY: event.clientY, x: node.x, y: node.y, moved: false };
        }}
        onPointerMove={event => {
          const start = drag.current;
          if (!start || start.id !== node.id || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const dx = event.clientX-start.startX, dy = event.clientY-start.startY;
          if (!start.moved && Math.hypot(dx,dy) < 4) return;
          start.moved = true;
          setPosition({ id: node.id, x: Math.max(13, Math.min(87, start.x+dx*100/size.width)), y: Math.max(12, Math.min(88, start.y+dy*100/size.height)) });
        }}
        onPointerUp={event => {
          if (drag.current?.id !== node.id) return;
          if (drag.current.moved && position) {
            props.onChange({ ...props.document, nodes: props.document.nodes.map(n => n.id === node.id ? { ...n, x: position.x, y: position.y } : n) });
            props.onSelect(node.id);
          }
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          setPosition(null);
        }}
        onPointerCancel={() => { drag.current = null; setPosition(null); }}
      ><span className="node-port"/><span className="node-label">{node.label}</span></button>)}
    </div>
    {!nodes.length && <div className="empty-canvas"><strong>Your next explanation starts here.</strong><p>Add a node, then build a scenario.</p></div>}
    <div className="canvas-legend"><span><i className="legend-active"/> Current Step</span>{!props.readOnly && <span><i className="legend-selected"/> Selected Node</span>}</div>
  </section>;
}
