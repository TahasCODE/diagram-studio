import {NODE_TYPES,NODE_TYPE_KEYS,PALETTE_MIME} from '../lib/nodeTypes';
import type {NodeType} from '../lib/nodeTypes';
import {NodeGlyph} from './NodeGlyph';
import {Icon} from './Icon';
import '../styles/palette.css';
export function NodePalette({onAdd,disabled,selectedLabel,onRemove}:{onAdd:(type:NodeType)=>void;disabled:boolean;selectedLabel?:string;onRemove?:()=>void}){
  return <details className="node-palette" open><summary>Component Palette<span>{NODE_TYPE_KEYS.length} types</span></summary><p>Click to add. On desktop, drag a component onto the canvas.</p><div className="palette-grid">{NODE_TYPE_KEYS.map(type=><button key={type} type="button" disabled={disabled} draggable={!disabled} aria-label={'Add '+NODE_TYPES[type].label} title={NODE_TYPES[type].description} onClick={()=>onAdd(type)} onDragStart={event=>{event.dataTransfer.setData(PALETTE_MIME,type);event.dataTransfer.effectAllowed='copy';}}><span className={'node-type '+type}><NodeGlyph kind={type}/></span><span>{NODE_TYPES[type].label}</span></button>)}</div>{disabled&&<p role="status">The diagram has reached its 500-node limit.</p>}<div className="palette-selection"><p>{selectedLabel?<>Selected: <strong>{selectedLabel}</strong></>:'Select a component on the canvas to remove it.'}</p><button type="button" className="danger" disabled={!onRemove} onClick={onRemove}><Icon name="trash" size={14}/>Delete Selected Component</button><small>Removes this node and its scenario steps. Use Undo to restore it.</small></div></details>;
}
