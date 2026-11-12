import type { ReactNode } from 'react';
import { Icon } from './Icon';
export type Panel = 'playback' | 'editor' | 'project';
interface Props {
  title: string; scenarioName: string; stepCount: number; nodeCount: number; scenarioCount: number;
  readOnly: boolean; isRemix: boolean; dark: boolean; onTheme: () => void;
  panel: Panel; onPanel: (panel: Panel) => void; onProjects: () => void; onHistory: () => void;
  canHistory: boolean; version?: number; busy: boolean; saveLabel: string; saveError: boolean;
  headerActions: ReactNode; sidebar: ReactNode; banners: ReactNode; children: ReactNode; notice: string;
}
export function WorkspaceShell(props: Props) {
  const tabs: {id:Panel;label:string}[] = [{id:'playback',label:'Playback'},...(!props.readOnly ? [{id:'editor' as const,label:'Editor'},{id:'project' as const,label:'Project'}] : [])];
  return <>
    <header className="app-header">
      <a className="brand" href="/" aria-label="Diagram Studio Home"><span className="brand-mark"><Icon name="diagram" size={21}/></span><h1>Diagram Studio</h1></a>
      <div className="header-divider"/><span className="header-context">{props.readOnly?'Published diagram':props.isRemix?'Remix workspace':'Personal workspace'}</span>
      <div className="actions header-actions"><span id="save-state" className={'save-state'+(props.saveError?' save-error':'')} role="status"><span className="status-dot"/>{props.saveLabel}</span>
        <button id="theme-toggle" className="icon-button" aria-label={props.dark?'Use Light Theme':'Use Dark Theme'} title={props.dark?'Light Theme':'Dark Theme'} aria-pressed={props.dark} onClick={props.onTheme}><Icon name={props.dark?'sun':'moon'}/></button>
        {props.headerActions}
      </div>
    </header>
    {props.banners}
    <div className="workbench">
      <nav className="navigation-rail" aria-label="Workspace Navigation">
        <button id="my-projects" disabled={props.busy} onClick={props.onProjects} title="My Projects"><Icon name="folder"/><span>Projects</span></button>
        <div className="rail-divider"/>
        <button className={props.panel==='playback'?'is-active':''} onClick={() => props.onPanel('playback')} title="Scenario Playback"><Icon name="play"/><span>Play</span></button>
        {!props.readOnly && <><button className={props.panel==='editor'?'is-active':''} onClick={() => props.onPanel('editor')} title="Edit Diagram"><Icon name="edit"/><span>Edit</span></button><button className={props.panel==='project'?'is-active':''} onClick={() => props.onPanel('project')} title="Project Tools"><Icon name="file"/><span>Project</span></button><div className="rail-divider"/><button disabled={!props.canHistory||props.busy} onClick={props.onHistory} title="Version History"><Icon name="history"/><span>History</span></button></>}
        <span className="rail-footnote" title="Diagram Studio"><Icon name="diagram" size={16}/></span>
      </nav>
      <main>
        <div className="workspace">
          <div className="workspace-heading"><div className="workspace-title"><p className="eyebrow">{props.readOnly?'PUBLISHED DIAGRAM':'DIAGRAM WORKSPACE'}</p><h2 id="project-heading">{props.title}</h2><p className="workspace-description"><span className="scenario-dot"/>{props.scenarioName}<span className="description-divider">/</span>{props.stepCount} steps</p></div><span className="canvas-badge"><span/>Live Canvas</span></div>
          {props.children}
          <div className="workspace-footer"><span>{props.nodeCount} nodes<span className="footer-separator"/> {props.scenarioCount} scenarios{props.version && <><span className="footer-separator"/>Version {props.version}</>}</span><span>{props.readOnly?'Read-only playback':'Changes stay local until saved online'}</span></div>
        </div>
        <aside aria-label="Diagram Controls">
          <div className="inspector-heading"><span>{props.readOnly?'EXPLORE':'INSPECTOR'}</span><span className="inspector-meta">{props.readOnly?'Shared snapshot':props.version?'Version '+props.version:'Local draft'}</span></div>
          <div className="inspector-tabs" role="tablist" aria-label="Diagram Panels">{tabs.map(tab => <button key={tab.id} id={'tab-'+tab.id} role="tab" aria-selected={props.panel===tab.id} aria-controls={'panel-'+tab.id} tabIndex={props.panel===tab.id?0:-1} onClick={() => props.onPanel(tab.id)} onKeyDown={event => {
            const index=tabs.findIndex(t=>t.id===props.panel); const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:-1;
            if(next>=0){event.preventDefault();event.stopPropagation();props.onPanel(tabs[next].id);globalThis.document.getElementById('tab-'+tabs[next].id)?.focus();}
          }}>{tab.label}</button>)}</div>
          <div className="inspector-content">{props.sidebar}</div>
        </aside>
      </main>
    </div>
    {props.notice && <div className="notice-bar" role="status"><Icon name="check" size={15}/><span>{props.notice}</span></div>}
  </>;
}
