import { describe, expect, it } from 'vitest';
import { diagramSvg } from './imageExport';
import { examples } from './examples';
describe('portable diagram images',()=>{
  const options={appearance:'light' as const,transparent:false,playback:false};
  it('escapes user text without executable markup or external resources',()=>{
    const document=structuredClone(examples.refund);document.title='<script>alert("x")</script>';document.nodes[0].label='<img src=x onerror=alert(1)>';
    const svg=diagramSvg(document,0,0,options);
    expect(svg).toContain('&lt;script&gt;');expect(svg).not.toContain('<script');expect(svg).not.toContain('<img');expect(svg).not.toContain('foreignObject');expect(svg).not.toContain('href=');
  });
  it('exports all nodes, preserves titles and explicitly controls background and playback',()=>{
    const whole=diagramSvg(examples.refund,0,1,options);
    for(const node of examples.refund.nodes)expect(whole).toContain(`<title>${node.label}</title>`);
    expect(whole).toContain('Whole diagram');expect(whole).toContain('fill="#f4f8f5"');
    const step=diagramSvg(examples.refund,0,1,{appearance:'dark',transparent:true,playback:true});
    expect(step).toContain('Step 2 of');expect(step).toContain('fill="#3a8060"');expect(step).not.toContain('<rect width="100%"');
    expect(examples.refund.scenarios.every(s=>!s.review)).toBe(true);
  });
  it('handles empty paths and edge positions with bounded nodes',()=>{
    const svg=diagramSvg({nodes:[{id:'a',label:'Edge',x:0,y:100}],scenarios:[{name:'Empty',steps:[]}]},0,0,{...options,playback:true});
    expect(svg).toContain('Step 0 of 0');expect(svg).not.toMatch(/NaN|undefined/);expect(svg).toContain('x="56"');
  });
});
