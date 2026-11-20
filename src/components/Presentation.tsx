import { useEffect, useRef, useState } from 'react';
import type { Diagram } from '../lib/model';
import { Canvas } from './Canvas';
import { Playback } from './Playback';
import type { GuidedPlayback } from './Playback';
import { Icon } from './Icon';

interface Props {
  document:Diagram; scenario:number; step:number; guided?:GuidedPlayback;
  onScenario:(index:number)=>void; onStep:(index:number)=>void; onClose:()=>void;
}
export function Presentation(props:Props){
  const dialog=useRef<HTMLDialogElement>(null);
  const surface=useRef<HTMLDivElement>(null);
  const [fullscreen,setFullscreen]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    const element=dialog.current!,screen=surface.current!;element.showModal();
    const changed=()=>setFullscreen(globalThis.document.fullscreenElement===screen);
    globalThis.document.addEventListener('fullscreenchange',changed);
    return()=>{
      globalThis.document.removeEventListener('fullscreenchange',changed);
      if(globalThis.document.fullscreenElement===screen)void globalThis.document.exitFullscreen().catch(()=>{});
      element.close();
      requestAnimationFrame(()=>globalThis.document.getElementById('present-diagram')?.focus());
    };
  },[]);
  useEffect(()=>{
    const navigate=(event:KeyboardEvent)=>{
      if(event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||(event.target as HTMLElement).closest('input,textarea,select,[contenteditable]')||globalThis.document.querySelector('dialog[open] dialog[open]'))return;
      const target=event.key==='ArrowRight'?props.step+1:event.key==='ArrowLeft'?props.step-1:event.key==='Home'?0:null;
      if(target!==null){event.preventDefault();props.onStep(target);}
    };
    window.addEventListener('keydown',navigate);
    return()=>window.removeEventListener('keydown',navigate);
  },[props.step,props.onStep]);
  const toggleFullscreen=async()=>{
    try{setMessage('');if(fullscreen)await globalThis.document.exitFullscreen();else await surface.current!.requestFullscreen();}
    catch{setMessage('Browser full screen is unavailable. Presentation mode is still active.');}
  };
  return <dialog ref={dialog} className="presentation" aria-labelledby="presentation-title" onCancel={event=>{event.preventDefault();props.onClose();}}>
    <div ref={surface} className="presentation-surface">
    <header className="presentation-header"><div><p className="section-overline">PRESENTATION MODE</p><h1 id="presentation-title">{props.document.title||'Untitled Diagram'}</h1></div><div className="actions">{globalThis.document.fullscreenEnabled&&<button onClick={()=>void toggleFullscreen()}><Icon name="fit" size={16}/>{fullscreen?'Exit Full Screen':'Full Screen'}</button>}<button className="primary" autoFocus onClick={props.onClose} aria-label="Exit Presentation"><Icon name="close" size={16}/><span>Exit</span></button></div></header>
    {message&&<p className="presentation-message" role="status">{message}</p>}
    <div className="presentation-layout"><div className="presentation-canvas"><Canvas document={props.document} scenario={props.scenario} step={props.step} readOnly presentation onSelect={()=>{}} onChange={()=>{}} onUndo={()=>{}} onRedo={()=>{}} canUndo={false} canRedo={false}/></div><aside className="presentation-reader" aria-label="Presentation Playback"><Playback {...props} readOnly/></aside></div>
    <footer className="presentation-footer"><span>← / → Step through · Home Restart path · Esc Exit</span><span>Read-only presentation · No account needed</span></footer>
    </div>
  </dialog>;
}
