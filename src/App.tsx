import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Canvas } from './components/Canvas';
import { Editor } from './components/Editor';
import { Playback } from './components/Playback';
import { Dialog } from './components/Dialog';
import { WorkspaceShell } from './components/WorkspaceShell';
import type { Panel } from './components/WorkspaceShell';
import { Icon } from './components/Icon';
import { examples } from './lib/examples';
import { exportProject, historyReducer, parseDiagram, publishedDocument, readProjectFile, STORAGE_KEY } from './lib/model';
import type { Diagram } from './lib/model';
import { ApiError, request, saveProject, session } from './lib/api';
import type { Account, Draft, ProjectSummary, Publication, PublicationSummary, RevisionSummary, Revision, PageResponse, AuditEvent } from './lib/api';

const remix = new URLSearchParams(location.search).has('remix');
const localKey = STORAGE_KEY + (remix ? '-remix' : '');
const cloudKey = localKey + '-cloud';
const publicationId = location.pathname.match(/^\/p\/([a-f0-9-]{36})\/?$/i)?.[1];
interface CloudDraft { id: string; version: number; ownerId: string; savedJson: string }
function initialProject() {
  let message = '';
  if (location.hash) {
    try { return { document: parseDiagram(JSON.parse(decodeURIComponent(location.hash.slice(1)))), shared: true, message }; }
    catch { message = 'This old playback link is invalid. Your local workspace is shown instead.'; }
  }
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      try { return { document: parseDiagram(JSON.parse(raw)), shared: false, message }; }
      catch {
        localStorage.setItem(localKey + '-migration-backup', raw);
        message = 'Your previous project could not be opened. A recovery copy was kept in browser storage; you can import a compatible JSON backup.';
      }
    }
  } catch { message = 'Browser storage is unavailable. Export your work before leaving this page.'; }
  return { document: structuredClone(examples.refund), shared: false, message };
}
const initial = initialProject();
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export default function App() {
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: initial.document, future: [] });
  const document = history.present;
  const documentRef = useRef(document); documentRef.current = document;
  const [scenarioState, setScenario] = useState(0);
  const scenario = Math.min(scenarioState, document.scenarios.length-1);
  const [stepState, setStep] = useState(0);
  const step = Math.max(0, Math.min(stepState, document.scenarios[scenario].steps.length-1));
  const [selected, setSelected] = useState<string | undefined>(document.nodes[0]?.id);
  const [user, setUser] = useState<Account | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);
  const [active, setActive] = useState<CloudDraft | null>(null);
  const [localSaved, setLocalSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(initial.message);
  const [cloudError, setCloudError] = useState('');
  const [viewerLoading, setViewerLoading] = useState(!!publicationId);
  const [viewerError, setViewerError] = useState('');
  const readOnly = !!publicationId || initial.shared;
  const [dark, setDark] = useState(() => { try { return localStorage.getItem(STORAGE_KEY+'-theme') === 'dark'; } catch { return false; } });
  const [modal, setModal] = useState<'auth'|'projects'|'confirm'|'share'|'history'|'activity'|null>(null);
  const [panel, setPanel] = useState<Panel>('playback');
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [revisionError, setRevisionError] = useState('');
  const [revisionPreview, setRevisionPreview] = useState<Revision | null>(null);
  const [authMode, setAuthMode] = useState<'login'|'register'>('login');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authSuccess, setAuthSuccess] = useState<Account | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectQuery, setProjectQuery] = useState('');
  const [appliedProjectQuery, setAppliedProjectQuery] = useState('');
  const [projectPage, setProjectPage] = useState<PageResponse<ProjectSummary> | null>(null);
  const [activity, setActivity] = useState<PageResponse<AuditEvent> | null>(null);
  const [activityError, setActivityError] = useState('');
  const [activityProject, setActivityProject] = useState<string | undefined>();
  const [activityLoading, setActivityLoading] = useState(false);
  const [projectListError, setProjectListError] = useState('');
  const [projectListLoading, setProjectListLoading] = useState(false);
  const [publications, setPublications] = useState<PublicationSummary[]>([]);
  const [shareUrl, setShareUrl] = useState('');
  const [confirmDetails, setConfirmDetails] = useState<{title: string; message: string; action: () => void}>();
  const [demo, setDemo] = useState('refund');
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<Diagram | null>(null);
  const cloudDirty = active ? active.savedJson !== JSON.stringify(document) : true;

  useEffect(() => {
    let cancelled = false;
    session().then(account => {
      if (cancelled) return;
      setUser(account); setApiOnline(true);
      if (account && !readOnly) {
        try {
          const cached = JSON.parse(localStorage.getItem(cloudKey) || 'null');
          if (cached?.ownerId === account.id && typeof cached.id === 'string' && Number.isSafeInteger(cached.version) && typeof cached.savedJson === 'string') setActive(cached);
        } catch { /* Keep the local document usable if workspace metadata is unavailable. */ }
      }
    }).catch(() => { if (!cancelled) setApiOnline(false); }).finally(() => { if (!cancelled) setSessionReady(true); });
    return () => { cancelled = true; };
  }, [readOnly]);

  useEffect(() => {
    if (!publicationId) return;
    let cancelled = false;
    request<Publication>('/publications/'+publicationId).then(publication => {
      const next = parseDiagram(publication.document);
      if (!cancelled) { dispatch({type:'reset',document:next}); setSelected(undefined); }
    }).catch(error => { if (!cancelled) setViewerError(errorMessage(error)); })
      .finally(() => { if (!cancelled) setViewerLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (readOnly) return;
    try { localStorage.setItem(localKey, JSON.stringify(document)); setLocalSaved(true); }
    catch { setLocalSaved(false); }
  }, [document, readOnly]);
  useEffect(() => {
    if (readOnly) return;
    try { if (active) localStorage.setItem(cloudKey,JSON.stringify(active)); else if (sessionReady) localStorage.removeItem(cloudKey); } catch { /* Local save status covers storage availability. */ }
  }, [active, readOnly, sessionReady]);
  useEffect(() => {
    globalThis.document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem(STORAGE_KEY+'-theme',dark ? 'dark' : 'light'); } catch { /* Theme is still applied for this visit. */ }
  }, [dark]);
  useEffect(() => { globalThis.document.title = (document.title || 'Untitled Diagram')+' — Diagram Studio'; }, [document.title]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (!readOnly && !localSaved) event.preventDefault(); };
    window.addEventListener('beforeunload',warn); return () => window.removeEventListener('beforeunload',warn);
  }, [localSaved,readOnly]);

  const onScenario = (index: number) => { setScenario(index); setStep(0); };
  const edit = (fn: (draft: Diagram) => void) => {
    const next = structuredClone(documentRef.current); fn(next);
    try { dispatch({type:'edit',document:parseDiagram(next)}); } catch(error) { setNotice(errorMessage(error)); }
  };
  const confirm = (title: string, message: string, action: () => void) => { setConfirmDetails({title,message,action}); setModal('confirm'); };
  const openDocument = (next: Diagram, source: CloudDraft | null = null) => {
    dispatch({type:'reset',document:next}); setActive(source); setScenario(0); setStep(0); setSelected(next.nodes[0]?.id); setCloudError(''); setNotice('');
  };
  const replaceLocalDocument = (next: Diagram) => {
    dispatch({type:'edit',document:next}); setActive(null); setScenario(0); setStep(0); setSelected(next.nodes[0]?.id); setCloudError(''); setNotice('Local workspace replaced. Use Undo to restore the previous diagram.');
  };
  const openAuth = () => { setAuthError(''); setAuthMessage(''); setAuthSuccess(null); setAuthMode('login'); setModal('auth'); };
  const onKey = useCallback((event: KeyboardEvent) => {
    if ((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])') || globalThis.document.querySelector('dialog[open]')) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      if (!readOnly && event.key.toLowerCase() === 'z') { event.preventDefault(); dispatch({type:event.shiftKey?'redo':'undo'}); }
      if (!readOnly && event.key.toLowerCase() === 'y') { event.preventDefault(); dispatch({type:'redo'}); }
      return;
    }
    if (event.altKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); setStep(Math.max(0,step-1)); }
    if (event.key === 'ArrowRight') { event.preventDefault(); setStep(Math.max(0,Math.min(document.scenarios[scenario].steps.length-1,step+1))); }
    if (event.key === 'Home') { event.preventDefault(); setStep(0); }
  }, [readOnly,step,scenario,document.scenarios]);
  useEffect(() => { window.addEventListener('keydown',onKey); return () => window.removeEventListener('keydown',onKey); }, [onKey]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setAuthError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const mode = authMode;
    try {
      await session();
      const account = await request<Account>('/auth/'+mode,'POST',{email:form.get('email'),password:form.get('password'),...(mode==='register'?{name:form.get('name')}:{})});
      if (mode === 'register') {
        setAuthEmail(String(form.get('email') || ''));
        formElement.reset(); setAuthMode('login');
        setAuthMessage('Account created successfully. Sign in with your email and password to continue.');
        setApiOnline(true);
      } else {
        const confirmed = await session();
        if (!confirmed || confirmed.id !== account.id) throw new Error('Could not verify your signed-in session. Please try again.');
        setUser(confirmed); setSessionReady(true); setApiOnline(true); setActive(null);
        formElement.reset(); setAuthSuccess(confirmed); setAuthMessage('');
        setNotice('Signed in successfully. Your private workspace is ready.');
      }
    } catch(error) { setAuthError(errorMessage(error)); } finally { setBusy(false); }
  }
  async function saveOnline(copy = false): Promise<Draft | null> {
    if (!user) { openAuth(); return null; }
    const snapshot = structuredClone(documentRef.current);
    const draft = await saveProject(snapshot,copy ? null : active);
    setActive({id:draft.id,version:draft.version,ownerId:user.id,savedJson:JSON.stringify(snapshot)});
    setApiOnline(true); setCloudError('');
    return draft;
  }
  async function saveClick(copy = false) {
    if (busy) return;
    if (!user) { openAuth(); return; }
    setBusy(true);
    try { await saveOnline(copy); setNotice(copy ? 'A separate project copy was saved online.' : 'Project saved online.'); }
    catch(error) { setCloudError(errorMessage(error)); if (error instanceof ApiError && error.status === 401) setUser(null); }
    finally { setBusy(false); }
  }
  async function loadProjects() {
    if (!user) { openAuth(); return; }
    setModal('projects'); setProjectQuery(''); await loadProjectPage(0,'');
  }
  async function loadProjectPage(page: number,query: string) {
    setProjectListLoading(true); setProjectListError('');
    try { const result=await request<PageResponse<ProjectSummary>>(`/projects?page=${page}&size=12&q=${encodeURIComponent(query)}`);setProjectPage(result);setProjects(result.items);setAppliedProjectQuery(query); }
    catch(error) { setProjectListError(errorMessage(error)); } finally { setProjectListLoading(false); }
  }
  async function loadActivity(page=0,projectId?: string) {
    if(!user){openAuth();return;}
    setModal('activity');setActivityProject(projectId);setActivityLoading(true);setActivityError('');
    try {setActivity(await request<PageResponse<AuditEvent>>(`/activity?page=${page}&size=12${projectId?'&projectId='+encodeURIComponent(projectId):''}`));}
    catch(error){setActivityError(errorMessage(error));}finally{setActivityLoading(false);}
  }
  async function openProject(id: string) {
    setBusy(true);
    try {
      const draft = await request<Draft>('/projects/'+id);
      const next = parseDiagram(draft.document);
      const source = {id:draft.id,version:draft.version,ownerId:user!.id,savedJson:JSON.stringify(next)};
      if (readOnly) {
        localStorage.setItem(STORAGE_KEY,JSON.stringify(next)); localStorage.setItem(STORAGE_KEY+'-cloud',JSON.stringify(source)); location.assign('/'); return;
      }
      openDocument(next,source); setModal(null);
    } catch(error) { setProjectListError(errorMessage(error)); } finally { setBusy(false); }
  }
  async function loadRevisions() {
    if (!active || busy) return;
    setModal('history'); setRevisionLoading(true); setRevisionError(''); setRevisionPreview(null);
    try { setRevisions(await request<RevisionSummary[]>(`/projects/${active.id}/revisions`)); }
    catch(error) { setRevisionError(errorMessage(error)); }
    finally { setRevisionLoading(false); }
  }
  async function restoreRevision(version: number) {
    if (!active || !user || busy) return;
    setBusy(true);
    try {
      const restored = await request<Draft>(`/projects/${active.id}/restore`,'POST',{version:active.version,revisionVersion:version});
      const next = parseDiagram(restored.document);
      openDocument(next,{id:restored.id,version:restored.version,ownerId:user.id,savedJson:JSON.stringify(next)});
      setModal(null); setNotice(`Version ${version} restored as version ${restored.version}. All earlier versions were retained.`);
    } catch(error) { setCloudError(errorMessage(error)); setModal(null); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (busy) return;
    if (readOnly) { setShareUrl(location.href); setPublications([]); setModal('share'); return; }
    if (!user) { setNotice('Sign in to publish a permanent playback link. You can keep editing without an account.'); openAuth(); return; }
    setBusy(true);
    try {
      const draft = await saveOnline();
      if (!draft) return;
      const publication = await request<PublicationSummary>(`/projects/${draft.id}/publications`,'POST',{version:draft.version});
      setShareUrl(new URL('/p/'+publication.id,location.origin).href);
      setPublications(await request<PublicationSummary[]>(`/projects/${draft.id}/publications`));
      setModal('share'); setNotice('Published a fixed snapshot. Later draft edits will not change this link.');
    } catch(error) { setCloudError(errorMessage(error)); } finally { setBusy(false); }
  }
  async function remixDiagram() {
    setBusy(true);
    try {
      const next = structuredClone(document);
      let source: CloudDraft | null = null;
      if (publicationId && user) {
        const draft = await request<Draft>('/publications/'+publicationId+'/remix','POST');
        const remixed = parseDiagram(draft.document);
        Object.assign(next,remixed);
        source = {id:draft.id,version:draft.version,ownerId:user.id,savedJson:JSON.stringify(remixed)};
      }
      localStorage.setItem(STORAGE_KEY+'-remix',JSON.stringify(next));
      if (source) localStorage.setItem(STORAGE_KEY+'-remix-cloud',JSON.stringify(source)); else localStorage.removeItem(STORAGE_KEY+'-remix-cloud');
      location.assign('/?remix=1');
    } catch(error) { setNotice(errorMessage(error)); } finally { setBusy(false); }
  }
  async function copyLink(url: string) {
    try { await navigator.clipboard.writeText(url); setNotice('Playback link copied.'); }
    catch { setNotice('Select and copy the link in the Share dialog.'); }
  }
  const exportFile = () => {
    const url = URL.createObjectURL(new Blob([exportProject(document)],{type:'application/json'}));
    const link = globalThis.document.createElement('a'); link.href=url; link.download='diagram-studio-project.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000); setNotice('Project file exported.');
  };

  if (viewerLoading || viewerError) return <div className="page-state"><h1>Diagram Studio</h1><p role="status">{viewerLoading ? 'Loading Published Diagram…' : viewerError}</p>{viewerError && <a href="/">Open Your Workspace</a>}</div>;

  return <>
    <WorkspaceShell title={document.title || 'Untitled Diagram'} scenarioName={document.scenarios[scenario].name} stepCount={document.scenarios[scenario].steps.length} nodeCount={document.nodes.length} scenarioCount={document.scenarios.length}
      readOnly={readOnly} isRemix={remix} dark={dark} onTheme={() => setDark(!dark)} panel={panel} onPanel={setPanel}
      onProjects={loadProjects} onHistory={loadRevisions} canHistory={!!active} version={active?.version} busy={busy}
      saveLabel={readOnly?'Published Playback':!localSaved?'Local Save Failed':active&&!cloudDirty?'Saved Online':'Saved Locally'} saveError={!localSaved} notice={notice}
      headerActions={<>
        {user ? <button className="account-button" disabled={busy} title={user.email} aria-label="Sign Out" onClick={() => confirm('Sign Out','Sign out and clear this local workspace? Export or save changes you want to keep first.',async () => {setBusy(true);try {await request('/auth/logout','POST');await session();setUser(null);setActive(null);if(readOnly)location.assign('/');else openDocument(structuredClone(examples.refund));}catch(error){setNotice(errorMessage(error));}finally{setBusy(false);}})}><span className="account-avatar">{user.name.slice(0,1).toUpperCase()}</span><span className="account-name">{user.name.split(' ')[0]}</span></button> : <button id="sign-in" className="quiet-button" disabled={!sessionReady||busy} onClick={openAuth}><Icon name="user" size={16}/>Sign In</button>}
        {readOnly ? <button id="remix" disabled={busy} onClick={remixDiagram}><Icon name="branch" size={16}/>Remix Diagram</button> : <button id="save-online" disabled={busy||!sessionReady} onClick={() => saveClick()}><Icon name="save" size={16}/>{busy?'Saving…':'Save Online'}</button>}
        <button id="share" className="primary" disabled={busy||!sessionReady} onClick={publish}><Icon name="share" size={16}/>{readOnly?'Share Diagram':'Publish & Share'}</button>
      </>}
      banners={<>
        {!apiOnline && <div className="app-banner" role="status">Project storage is offline. Your local workspace is available.<button onClick={() => {session().then(account => {setUser(account);setApiOnline(true);}).catch(() => setNotice('Project storage is still unavailable.'));}}>Reconnect</button></div>}
        {cloudError && <div className="app-banner error-banner" role="alert">{cloudError}<button disabled={busy} onClick={() => saveClick(true)}>Save as Separate Copy</button><button onClick={() => setCloudError('')}>Dismiss</button></div>}
      </>}
      sidebar={<>
        <div id="panel-playback" role="tabpanel" aria-labelledby="tab-playback" hidden={panel!=='playback'}>
          <Playback document={document} scenario={scenario} step={step} readOnly={readOnly} onScenario={onScenario} onStep={setStep}/>
          <div className="panel-note"><Icon name="branch" size={16}/><p>Each scenario follows a different path through the same diagram.</p></div>
        </div>
        {!readOnly && <>
          <div id="panel-editor" role="tabpanel" aria-labelledby="tab-editor" hidden={panel!=='editor'}><Editor document={document} scenario={scenario} selected={selected} onSelect={setSelected} onChange={edit} onScenario={onScenario} confirm={confirm}/></div>
          <div id="panel-project" role="tabpanel" aria-labelledby="tab-project" hidden={panel!=='project'}>
            <section className="project-overview"><p className="section-overline">PROJECT DETAILS</p><h2>{document.title||'Untitled Diagram'}</h2><p className="hint">{active?'Private draft in your account.':'A local draft in this browser.'}</p><dl className="project-facts"><div><dt>Nodes</dt><dd>{document.nodes.length}</dd></div><div><dt>Scenarios</dt><dd>{document.scenarios.length}</dd></div><div><dt>Online Version</dt><dd>{active?.version||'Not Saved'}</dd></div></dl><button id="version-history" className="full-width" disabled={!active||busy} onClick={loadRevisions}><Icon name="history" size={16}/>Version History</button><p className="hint">{active?'Preview and restore any saved version.':'Save online to start tracking versions.'}</p></section>
            <section className="project-operations"><div className="section-heading"><Icon name="history" size={17}/><h2>Activity & Reference</h2></div><p className="hint">Review saved project actions and explore the Java API.</p><div className="actions"><button id="project-activity" disabled={!active||busy} onClick={() => loadActivity(0,active?.id)}>Project Activity</button><a className="button-link" href="/api/docs" target="_blank" rel="noreferrer">API Reference<Icon name="external" size={14}/></a></div></section>
            <section id="examples"><div className="section-heading"><Icon name="arrange" size={17}/><h2>Example Projects</h2></div><p className="hint">Explore an existing system, then make it your own.</p><label htmlFor="demo">Choose an Example</label><div className="sample-picker"><select id="demo" value={demo} onChange={e => setDemo(e.target.value)}>{Object.entries(examples).map(([key,value]) => <option value={key} key={key}>{value.title}</option>)}</select><button id="load-demo" disabled={busy} onClick={() => confirm('Open Example','Replace this local workspace? Save online or export your current work first.',() => {replaceLocalDocument(structuredClone(examples[demo]));setPanel('playback');})}>Open</button></div></section>
            <section id="project-files"><div className="section-heading"><Icon name="file" size={17}/><h2>Import & Export</h2></div><p className="hint">Back up your diagram or move it between browsers. Version-1 prototype files are supported.</p><div className="file-actions"><button id="export-project" onClick={exportFile}><Icon name="download" size={16}/><span>Export Project<span className="button-description">Download a JSON backup</span></span></button><button id="import-project" disabled={busy} onClick={() => fileRef.current?.click()}><Icon name="upload" size={16}/><span>Import Project<span className="button-description">Open an existing JSON file</span></span></button><button onClick={() => {const url=new URL('/',location.origin);url.hash=encodeURIComponent(JSON.stringify(publishedDocument(document)));setShareUrl(url.href);setPublications([]);setModal('share');}}><Icon name="copy" size={16}/><span>Local Snapshot Link<span className="button-description">Share without saving online</span></span></button></div>
              <input ref={fileRef} type="file" id="project-file" accept=".json,application/json" hidden onChange={async e => {const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>1_048_576)throw new Error('Choose a project file under 1 MB.');const imported=readProjectFile(await file.text());pendingFile.current=imported;confirm('Import Project',`Replace this workspace with ${imported.nodes.length} nodes and ${imported.scenarios.length} scenarios? Your online projects are kept.`,() => {if(pendingFile.current)replaceLocalDocument(pendingFile.current);pendingFile.current=null;});}catch(error){setNotice(errorMessage(error));}}}/>
            </section>
          </div>
        </>}
      </>}
    >
      <Canvas document={document} scenario={scenario} step={step} selected={selected} readOnly={readOnly} onSelect={id => {setSelected(id);setPanel('editor');}} onChange={next => dispatch({type:'edit',document:next})} onUndo={() => dispatch({type:'undo'})} onRedo={() => dispatch({type:'redo'})} canUndo={!!history.past.length} canRedo={!!history.future.length}/>
    </WorkspaceShell>

    {modal === 'confirm' && confirmDetails && <Dialog title={confirmDetails.title} onClose={() => setModal(null)}><p className="dialog-copy">{confirmDetails.message}</p><div className="actions"><button className="primary" onClick={() => { setModal(null); confirmDetails.action(); }}>Continue</button><button onClick={() => setModal(null)}>Cancel</button></div></Dialog>}
    {modal === 'auth' && <Dialog title={authSuccess?'You’re Signed In':authMode==='login'?'Sign In to Diagram Studio':'Create Your Account'} onClose={() => {if(!busy)setModal(null);}}>
      {authSuccess ? <div className="auth-success" role="status"><span className="auth-success-icon"><Icon name="check" size={28}/></span><h3>Welcome back, {authSuccess.name.split(' ')[0]}.</h3><p>You’re securely signed in as <strong>{authSuccess.email}</strong>. Your saved projects and version history are ready.</p><button className="primary" onClick={() => {setModal(null);setAuthSuccess(null);}}>Continue to Workspace<Icon name="right" size={16}/></button></div> : <>
        <p className="dialog-copy">{authMode==='login'?'Sign in to save private projects, publish diagrams, and recover previous versions.':'Create an account, then sign in to your private workspace.'}</p>
        {authMessage && <div className="auth-created" role="status"><Icon name="check" size={18}/><p>{authMessage}</p></div>}
        <form onSubmit={authenticate} aria-busy={busy}>
          <fieldset disabled={busy}>
            {authMode==='register' && <><label htmlFor="account-name">Your Name</label><input id="account-name" name="name" autoComplete="name" maxLength={80} required/></>}
            <label htmlFor="email">Email Address</label><input id="email" name="email" type="email" autoComplete="username" maxLength={254} value={authEmail} onChange={e => setAuthEmail(e.target.value)} required/>
            <label htmlFor="password">Password</label><input key={authMode} id="password" name="password" type="password" autoComplete={authMode==='login'?'current-password':'new-password'} minLength={authMode==='register'?10:undefined} maxLength={72} required/>
            {authMode==='register' && <p className="hint">Use at least 10 characters (maximum 72 UTF-8 bytes).</p>}
            {authError && <p className="form-error" role="alert">{authError}</p>}
            <button className="primary" disabled={busy} type="submit">{busy&&<span className="loading-spinner" aria-hidden="true"/>}{busy?(authMode==='login'?'Signing In…':'Creating Account…'):authMode==='login'?'Sign In':'Create Account'}</button>
          </fieldset>
          {busy && <p className="auth-progress" role="status">{authMode==='login'?'Verifying your credentials and establishing a secure session…':'Creating your account securely…'}</p>}
        </form>
        <button className="text-button" disabled={busy} onClick={() => {setAuthMode(authMode==='login'?'register':'login');setAuthError('');setAuthMessage('');}}>{authMode==='login'?'New here? Create an Account':'Already registered? Sign In'}</button>
      </>}
    </Dialog>}
    {modal === 'projects' && <Dialog title="My Projects" onClose={() => {if(!busy)setModal(null);}}><p className="dialog-copy">Your private drafts. Publishing creates a separate public snapshot.</p>{projectListLoading && <p role="status">Loading Projects…</p>}{projectListError && <p className="form-error" role="alert">{projectListError}</p>}{!projectListLoading&&!projectListError&&!projects.length&&<p className="hint">{appliedProjectQuery?"No projects match your search.":"No projects yet. Close this window and choose Save Online."}</p>}
      <form className="project-search" onSubmit={e => {e.preventDefault();void loadProjectPage(0,projectQuery);}}><label htmlFor="project-search">Search Your Projects</label><div className="sample-picker"><input id="project-search" type="search" maxLength={80} value={projectQuery} onChange={e => setProjectQuery(e.target.value)} placeholder="Search by title"/><button disabled={projectListLoading} type="submit">Search</button></div></form>
      <ul className="project-list">{projects.map(project => <li key={project.id}><div><strong>{project.title}</strong><p>Version {project.version} · {new Date(project.updatedAt).toLocaleDateString()}</p></div><div className="actions"><button disabled={busy} onClick={() => {if(!readOnly&&cloudDirty)confirm('Open Project','Replace this local workspace? Save or export unsynced changes first.',() => {void openProject(project.id);});else void openProject(project.id);}}>Open</button><button className="danger" disabled={busy} aria-label={'Delete '+project.title} onClick={() => confirm('Delete Project',`Delete “${project.title}” and revoke all its published links? This cannot be undone.`,async () => {setBusy(true);try{await request(`/projects/${project.id}?version=${project.version}`,'DELETE');if(active?.id===project.id)setActive(null);setNotice('Project deleted. Its published links have been revoked.');}catch(error){setNotice(errorMessage(error));}finally{setBusy(false);}})}>Delete</button></div></li>)}</ul>
      {projectPage&&projectPage.totalPages>0&&<div className="page-controls"><button disabled={projectListLoading||projectPage.page===0} onClick={() => loadProjectPage(projectPage.page-1,appliedProjectQuery)}>Previous</button><span>Page {projectPage.page+1} of {projectPage.totalPages} &middot; {projectPage.total} projects</span><button disabled={projectListLoading||projectPage.page+1>=projectPage.totalPages} onClick={() => loadProjectPage(projectPage.page+1,appliedProjectQuery)}>Next</button></div>}
      <button className="text-button" onClick={() => loadActivity(0)}>View Account Activity</button>
      <button disabled={busy} onClick={() => confirm('New Project','Start a blank local workspace? Save or export your current work first.',() => { if(readOnly){location.assign('/');return;} openDocument({title:'Untitled Diagram',nodes:[],scenarios:[{name:'Main Scenario',steps:[]}]});})}>+ New Project</button>
    </Dialog>}
    {modal === 'share' && <Dialog title="Share This Diagram" onClose={() => setModal(null)}><p className="dialog-copy">Anyone with this link can explore the snapshot and remix it. Your private draft stays separate.</p><label htmlFor="playback-link">Playback Link</label><input id="playback-link" value={shareUrl} readOnly onFocus={e => e.currentTarget.select()}/><div className="actions"><button className="primary" onClick={() => copyLink(shareUrl)}>Copy Link</button><a className="button-link" href={shareUrl} target="_blank" rel="noreferrer">Open Playback ↗</a></div>
      {publications.length>1 && <><h3>Published Snapshots</h3><ul className="publication-list">{publications.map((p,i) => <li key={p.id}><a href={'/p/'+p.id} target="_blank" rel="noreferrer">{i===0?'Latest Snapshot':p.title} · {new Date(p.createdAt).toLocaleString()}</a></li>)}</ul></>}
      <p className="hint">{location.hostname==='localhost'||location.hostname==='127.0.0.1'?'This is a local address. Deploy the application before sharing it with someone on another computer.':'Publishing another version creates a new link. Existing snapshots stay unchanged.'}</p>
    </Dialog>}
    {modal === 'history' && <Dialog title="Version History" onClose={() => {if(!busy)setModal(null);}}>
      <p className="dialog-copy">Every online save keeps a recoverable version. Restoring an older version creates a new one; it never rewrites history or changes published links.</p>
      {revisionLoading && <p role="status">Loading saved versions…</p>}
      {revisionError && <p className="form-error" role="alert">{revisionError}</p>}
      {!revisionLoading&&!revisionError&&!revisions.length && <p className="hint">No saved versions yet.</p>}
      <ol className="revision-list">{revisions.map(revision => <li key={revision.version}><span className="revision-marker"><Icon name="history" size={15}/></span><div className="revision-information"><strong>Version {revision.version}{revision.version===active?.version&&<span className="current-version">Current</span>}</strong><p>{revision.title}</p><time dateTime={revision.createdAt}>{new Date(revision.createdAt).toLocaleString()}</time></div><div className="revision-actions"><button disabled={busy} aria-label={'Preview Version '+revision.version} onClick={async () => {if(!active)return;setBusy(true);setRevisionError('');try{const data=await request<Revision>(`/projects/${active.id}/revisions/${revision.version}`);setRevisionPreview({...data,document:parseDiagram(data.document)});}catch(error){setRevisionError(errorMessage(error));}finally{setBusy(false);}}}>Preview</button><button disabled={busy||revision.version===active?.version} aria-label={'Restore Version '+revision.version} onClick={() => confirm('Restore Version '+revision.version,`Restore this version as a new saved version? ${cloudDirty?'Unsaved local edits will be replaced. Export them first if you want to keep them.':'Your current saved version will remain in history.'}`,() => {void restoreRevision(revision.version);})}>Restore</button></div></li>)}</ol>
      {revisionPreview && <section className="revision-preview"><p className="section-overline">VERSION {revisionPreview.version} PREVIEW</p><h3>{revisionPreview.title}</h3><p>{revisionPreview.document.nodes.length} nodes · {revisionPreview.document.scenarios.length} scenarios</p><ul>{revisionPreview.document.scenarios.map((s,i) => <li key={i}>{s.name}<span>{s.steps.length} steps</span></li>)}</ul></section>}
      <p className="hint">The latest 100 saved versions are listed. For projects created before version history was added, tracking starts from the migration baseline.</p>
    </Dialog>}
    {modal==='activity'&&<Dialog title={activityProject?'Project Activity':'Account Activity'} onClose={() => setModal(null)}><p className="dialog-copy">A server-recorded history of successful project actions. Deleted-project events remain in your account activity.</p>{activityLoading&&<p role="status">Loading activity…</p>}{activityError&&<p className="form-error" role="alert">{activityError}</p>}{!activityLoading&&!activityError&&activity?.items.length===0&&<p className="hint">No activity recorded yet.</p>}<ul className="activity-list">{activity?.items.map(event=><li key={event.id}><strong>{event.action.split('_').map(word=>word.charAt(0)+word.slice(1).toLowerCase()).join(' ')}{event.version&&<span>Version {event.version}</span>}</strong><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></li>)}</ul>{activity&&activity.totalPages>0&&<div className="page-controls"><button disabled={activityLoading||activity.page===0} onClick={() => loadActivity(activity.page-1,activityProject)}>Previous</button><span>Page {activity.page+1} of {activity.totalPages}</span><button disabled={activityLoading||activity.page+1>=activity.totalPages} onClick={() => loadActivity(activity.page+1,activityProject)}>Next</button></div>}</Dialog>}
  </>;
}
