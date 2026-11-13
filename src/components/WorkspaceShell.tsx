import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
export type Panel = 'playback' | 'editor' | 'project';
interface Props {
  title: string; scenarioName: string; stepCount: number; nodeCount: number; scenarioCount: number;
  readOnly: boolean; isRemix: boolean; dark: boolean; onTheme: () => void;
  panel: Panel; onPanel: (panel: Panel) => void; onProjects: () => void; onHistory: () => void;
  canHistory: boolean; version?: number; busy: boolean; saveLabel: string; saveError: boolean;
  headerActions: ReactNode; sidebar: ReactNode; banners: ReactNode; children: ReactNode; notice: string; noticeVersion:number;
}
export function WorkspaceShell(props: Props) {
  const [compact,setCompact]=useState(()=>matchMedia('(max-width:1023px)').matches);
  const [inspectorOpen,setInspectorOpen]=useState(false);
  const [toast,setToast]=useState(props.notice);
  const [toastPaused,setToastPaused]=useState(false),[toastLeaving,setToastLeaving]=useState(false);
  const inspector=useRef<HTMLElement>(null);
  const previousPanel=useRef(props.panel);
  useEffect(()=>{const media=matchMedia('(max-width:1023px)');const change=()=>{setCompact(media.matches);setInspectorOpen(false);};media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{if(compact&&previousPanel.current!==props.panel)setInspectorOpen(true);previousPanel.current=props.panel;},[props.panel,compact]);
  useEffect(()=>{setToast(props.notice);setToastLeaving(false);},[props.notice,props.noticeVersion]);
  useEffect(()=>{setToastLeaving(false);if(!toast||toastPaused)return;const fade=setTimeout(()=>setToastLeaving(true),6800),dismiss=setTimeout(()=>setToast(''),7000);return()=>{clearTimeout(fade);clearTimeout(dismiss);};},[toast,toastPaused,props.noticeVersion]);
  useEffect(()=>{if(!compact||!inspectorOpen)return;const previous=document.activeElement as HTMLElement;const frame=requestAnimationFrame(()=>inspector.current?.querySelector<HTMLButtonElement>('.inspector-close')?.focus());return()=>{cancelAnimationFrame(frame);if(previous?.isConnected)previous.focus();};},[compact,inspectorOpen]);
  const onPanel=(panel:Panel)=>{props.onPanel(panel);if(compact)setInspectorOpen(true);};
  const tabs: {id:Panel;label:string}[] = [{id:'playback',label:'Playback'},...(!props.readOnly ? [{id:'editor' as const,label:'Editor'},{id:'project' as const,label:'Project'}] : [])];
  return <>
    <header className="app-header" inert={compact&&inspectorOpen}>
      <a className="brand" href="/" aria-label="Diagram Studio Home"><span className="brand-mark"><Icon name="diagram" size={21}/></span><h1>Diagram Studio</h1></a>
      <div className="header-divider"/><span className="header-context">{props.readOnly?'Published diagram':props.isRemix?'Remix workspace':'Personal workspace'}</span>
      <div className="actions header-actions"><span id="save-state" className={'save-state'+(props.saveError?' save-error':'')} role="status"><span className="status-dot"/>{props.saveLabel}</span>
        <button id="theme-toggle" className="icon-button" aria-label={props.dark?'Use Light Theme':'Use Dark Theme'} title={props.dark?'Light Theme':'Dark Theme'} aria-pressed={props.dark} onClick={props.onTheme}><Icon name={props.dark?'sun':'moon'}/></button>
        {props.headerActions}
      </div>
    </header>
    {props.banners}
    <div className="workbench">
      <nav className="navigation-rail" aria-label="Workspace Navigation" inert={compact&&inspectorOpen}>
        <button id="my-projects" disabled={props.busy} onClick={props.onProjects} title="My Projects" data-tooltip="My projects"><Icon name="folder"/><span>Projects</span></button>
        <div className="rail-divider"/>
        <button className={props.panel==='playback'?'is-active':''} onClick={() => onPanel('playback')} title="Scenario Playback" data-tooltip="Scenario playback" aria-pressed={props.panel==='playback'}><Icon name="play"/><span>Play</span></button>
        {!props.readOnly && <><button className={props.panel==='editor'?'is-active':''} onClick={() => onPanel('editor')} title="Edit Diagram" data-tooltip="Edit diagram" aria-pressed={props.panel==='editor'}><Icon name="edit"/><span>Edit</span></button><button className={props.panel==='project'?'is-active':''} onClick={() => onPanel('project')} title="Project Tools" data-tooltip="Project tools" aria-pressed={props.panel==='project'}><Icon name="file"/><span>Project</span></button><div className="rail-divider"/><button disabled={!props.canHistory||props.busy} onClick={props.onHistory} title="Version History" data-tooltip="Version history"><Icon name="history"/><span>History</span></button></>}
        <span className="rail-footnote" title="Diagram Studio"><Icon name="diagram" size={16}/></span>
      </nav>
      <main>
        <div className="workspace" inert={compact&&inspectorOpen} onClick={event=>{if(compact&&(event.target as HTMLElement).closest('.node'))setInspectorOpen(true);}}>
          <div className="workspace-heading"><div className="workspace-title"><p className="eyebrow">{props.readOnly?'PUBLISHED DIAGRAM':'DIAGRAM WORKSPACE'}</p><h2 id="project-heading">{props.title}</h2><p className="workspace-description"><span className="metadata-chip"><span className="scenario-dot"/>{props.scenarioName}</span><span className="metadata-chip">{props.stepCount} path steps</span><span className="metadata-chip">{props.nodeCount} diagram nodes</span></p></div><span className="canvas-badge"><span/>Live Canvas</span><button className="inspector-trigger" aria-expanded={inspectorOpen} aria-controls="diagram-inspector" onClick={()=>setInspectorOpen(!inspectorOpen)} title="Open Inspector"><Icon name="sliders" size={16}/><span>Inspector</span></button></div>
          {props.children}
          <div className="workspace-footer"><span>{props.nodeCount} nodes<span className="footer-separator"/> {props.scenarioCount} scenarios{props.version && <><span className="footer-separator"/>Version {props.version}</>}</span><span>{props.readOnly?'Read-only playback':'Changes stay local until saved online'}</span></div>
        </div>
        {compact&&inspectorOpen&&<button className="inspector-backdrop" aria-label="Close Inspector Backdrop" tabIndex={-1} onClick={()=>setInspectorOpen(false)}/>}
        <aside ref={inspector} id="diagram-inspector" className={'inspector'+(inspectorOpen?' is-open':'')} role={compact&&inspectorOpen?'dialog':undefined} aria-modal={compact&&inspectorOpen?true:undefined} aria-label="Diagram Controls" inert={compact&&!inspectorOpen} onTransitionEnd={event=>{if(event.target===event.currentTarget&&compact&&inspectorOpen&&!inspector.current?.contains(document.activeElement))inspector.current?.querySelector<HTMLButtonElement>('.inspector-close')?.focus();}} onKeyDown={event=>{
          if(!compact||!inspectorOpen)return;
          if(event.key==='Escape'){event.preventDefault();setInspectorOpen(false);}
          if(event.key==='Tab'){
            const controls=[...inspector.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
            const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
          }
        }}>
          <div className="inspector-heading"><span>{props.readOnly?'EXPLORE':'INSPECTOR'}</span><span className="inspector-meta">{props.readOnly?'Shared snapshot':props.version?'Version '+props.version:'Local draft'}</span><button className="icon-button inspector-close" aria-label="Close Inspector" onClick={()=>setInspectorOpen(false)}><Icon name="close"/></button></div>
          <div className="inspector-tabs" role="tablist" aria-label="Diagram Panels">{tabs.map(tab => <button key={tab.id} id={'tab-'+tab.id} role="tab" aria-selected={props.panel===tab.id} aria-controls={'panel-'+tab.id} tabIndex={props.panel===tab.id?0:-1} onClick={() => props.onPanel(tab.id)} onKeyDown={event => {
            const index=tabs.findIndex(t=>t.id===props.panel); const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:-1;
            if(next>=0){event.preventDefault();event.stopPropagation();props.onPanel(tabs[next].id);globalThis.document.getElementById('tab-'+tabs[next].id)?.focus();}
          }}>{tab.label}</button>)}</div>
          <div className="inspector-content">{props.sidebar}</div>
        </aside>
      </main>
    </div>
    {toast && <div className={'notice-bar'+(toastLeaving?' is-leaving':'')} role="status" data-tone={/success|saved|copied|published|exported|restored|signed out|signed in|deleted/i.test(toast)?'success':'info'} onMouseEnter={()=>setToastPaused(true)} onMouseLeave={()=>setToastPaused(false)} onFocusCapture={()=>setToastPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setToastPaused(false);}}><Icon name={/success|saved|copied|published|exported|restored|signed out|signed in|deleted/i.test(toast)?'check':'info'} size={16}/><span>{toast}</span><button className="icon-button" aria-label="Dismiss Notification" onClick={()=>setToast('')}><Icon name="close" size={14}/></button></div>}
  </>;
}
