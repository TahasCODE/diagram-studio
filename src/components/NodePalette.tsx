import {NODE_TYPES,NODE_TYPE_KEYS,PALETTE_MIME} from '../lib/nodeTypes';
import type {NodeType} from '../lib/nodeTypes';
import {NodeGlyph} from './NodeGlyph';
import '../styles/palette.css';
export function NodePalette({onAdd,disabled}:{onAdd:(type:NodeType)=>void;disabled:boolean}){
  return <details className="node-palette" open><summary>Component Palette<span>{NODE_TYPE_KEYS.length} types</span></summary><p>Click to add. On desktop, drag a component onto the canvas.</p><div className="palette-grid">{NODE_TYPE_KEYS.map(type=><button key={type} type="button" disabled={disabled} draggable={!disabled} aria-label={'Add '+NODE_TYPES[type].label} title={NODE_TYPES[type].description} onClick={()=>onAdd(type)} onDragStart={event=>{event.dataTransfer.setData(PALETTE_MIME,type);event.dataTransfer.effectAllowed='copy';}}><span className={'node-type '+type}><NodeGlyph kind={type}/></span><span>{NODE_TYPES[type].label}</span></button>)}</div>{disabled&&<p role="status">The diagram has reached its 500-node limit.</p>}</details>;
}
