import {useEffect,useRef} from 'react';
import {Icon} from './Icon';
import '../styles/help.css';

export function HelpMenu(){
  const menu=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const outside=(event:Event)=>{if(menu.current&&!menu.current.contains(event.target as Node))menu.current.open=false;};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&menu.current?.open){event.preventDefault();menu.current.open=false;menu.current.querySelector('summary')?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',escape);};
  },[]);
  return <details className="workspace-help" ref={menu}><summary aria-label="Help & About" title="Help & About"><Icon name="info"/><span>Help</span></summary><nav className="workspace-help-links" aria-label="Help & About Links" onClick={event=>{if((event.target as HTMLElement).closest('a')&&menu.current)menu.current.open=false;}}><p>HELP &amp; ABOUT</p><a href="/welcome">Product Home<Icon name="right" size={14}/></a><a href="/welcome#about">About Diagram Studio</a><a href="/demo.html" target="_blank" rel="noreferrer">Demo Video &amp; Transcript<Icon name="external" size={14}/></a><a href="/api/docs" target="_blank" rel="noreferrer">API Reference<Icon name="external" size={14}/></a><a href="https://github.com/TahasCODE/diagram-studio" target="_blank" rel="noreferrer">GitHub Source<Icon name="external" size={14}/></a><a href="/welcome#demo-limits">Public Demo Limits</a><span className="workspace-help-note">Edits are kept in this browser. Use Export JSON for a portable backup.</span></nav></details>;
}
