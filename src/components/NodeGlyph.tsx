import {NODE_TYPES} from '../lib/nodeTypes';
import type {NodeType} from '../lib/nodeTypes';
export function NodeGlyph({kind}:{kind:NodeType|'start'|'end'|'process'}){
  const path=kind==='start'?'m6 4 6 4-6 4V4Z':kind==='end'?'M8 2a6 6 0 1 0 0 12 6 6 0 1 0 0-12Zm0 3a3 3 0 1 0 0 6 3 3 0 1 0 0-6Z':kind==='process'?'M3 3h10v10H3V3Z':NODE_TYPES[kind].path;
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/></svg>;
}
