import {useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import {request} from '../lib/api';
import type {PageResponse,ProjectRole} from '../lib/api';
import type {Diagram} from '../lib/model';
import {Dialog} from './Dialog';
import '../styles/comments.css';

interface Discussion {id:string;nodeId:string;nodeLabel:string;authorId:string|null;authorName:string;body:string;resolved:boolean;version:number;createdAt:string;replyCount:number}
interface Reply {id:string;authorName:string;body:string;createdAt:string}
interface Props {projectId:string;actorId:string;role:ProjectRole;nodes:Diagram['nodes'];initialNodeId?:string;onClose:()=>void}
const message=(error:unknown)=>error instanceof Error?error.message:'Could not load this discussion.';
export function NodeComments({projectId,actorId,role,nodes,initialNodeId,onClose}:Props){
  const [nodeId,setNodeId]=useState(initialNodeId??''),[page,setPage]=useState(0),[refresh,setRefresh]=useState(0);
  const [threads,setThreads]=useState<PageResponse<Discussion>|null>(null),[loading,setLoading]=useState(true);
  const [selected,setSelected]=useState<Discussion|null>(null),[replies,setReplies]=useState<PageResponse<Reply>|null>(null),[replyPage,setReplyPage]=useState(0),[replyLoading,setReplyLoading]=useState(false);
  const [body,setBody]=useState(''),[drafts,setDrafts]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const base=`/projects/${projectId}/comments`;
  useEffect(()=>{
    let cancelled=false;setLoading(true);setError('');
    request<PageResponse<Discussion>>(`${base}?page=${page}&size=10${nodeId?'&nodeId='+encodeURIComponent(nodeId):''}`)
      .then(data=>{if(!cancelled)setThreads(data);}).catch(e=>{if(!cancelled)setError(message(e));}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[base,nodeId,page,refresh]);
  useEffect(()=>{
    if(!selected)return;
    let cancelled=false;setReplyLoading(true);setReplies(null);
    Promise.all([request<Discussion>(`${base}/${selected.id}`),request<PageResponse<Reply>>(`${base}/${selected.id}/replies?page=${replyPage}&size=20`)])
      .then(([thread,items])=>{if(!cancelled){setSelected(thread);setReplies(items);}})
      .catch(e=>{if(!cancelled)setError(message(e));}).finally(()=>{if(!cancelled)setReplyLoading(false);});
    return()=>{cancelled=true;};
  },[base,selected?.id,replyPage,refresh]);
  async function act(action:()=>Promise<void>){
    if(busy)return;setBusy(true);setError('');setNotice('');
    try{await action();setRefresh(n=>n+1);}catch(e){setError(message(e));}finally{setBusy(false);}
  }
  function start(event:FormEvent){event.preventDefault();void act(async()=>{
    const thread=await request<Discussion>(base,'POST',{nodeId,body});setBody('');setSelected(thread);setReplyPage(0);setPage(0);setNotice('Comment posted to the saved node.');
  });}
  function reply(event:FormEvent){event.preventDefault();if(!selected)return;const thread=selected;void act(async()=>{
    await request(`${base}/${thread.id}/replies`,'POST',{body:drafts[thread.id]??''});
    setDrafts(current=>({...current,[thread.id]:''}));setNotice('Reply posted.');
    const latest=await request<Discussion>(`${base}/${thread.id}`);setSelected(latest);setReplyPage(Math.max(0,Math.ceil(latest.replyCount/20)-1));
  });}
  const available=new Map(nodes.map(node=>[node.id,node.label]));
  for(const item of threads?.items??[])if(!available.has(item.nodeId))available.set(item.nodeId,item.nodeLabel+' (removed from this draft)');
  const canResolve=selected&&(role!=='VIEWER'||selected.authorId===actorId);
  return <Dialog title="Node Comments" className="comments-dialog" onClose={()=>{if(!busy)onClose();}}>
    <p className="dialog-copy">Review saved project nodes together. Comments are private to project members and stay out of published snapshots and exports.</p>
    {error&&<p className="form-error" role="alert">{error} Text is kept until a post is confirmed. Refresh before retrying to avoid duplicate messages.</p>}
    {notice&&<p className="comment-notice" role="status">{notice}</p>}
    <div className="comment-filter"><div><label htmlFor="comment-node">Node</label><select id="comment-node" value={nodeId} disabled={busy} onChange={event=>{setNodeId(event.target.value);setPage(0);setSelected(null);setError('');}}><option value="">All Nodes</option>{[...available].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div><button disabled={busy||loading||replyLoading} onClick={()=>setRefresh(n=>n+1)}>Refresh Comments</button></div>
    <form className="comment-compose" onSubmit={start}><label htmlFor="new-comment">Start a Discussion</label><textarea id="new-comment" maxLength={1000} required value={body} disabled={busy||!nodeId} onChange={event=>setBody(event.target.value)} placeholder={nodeId?'Ask a question or suggest a change…':'Choose a node to start a discussion'}/><div className="comment-compose-footer"><span className="hint">{body.length}/1000 · Save new nodes online first.</span><button className="primary" disabled={busy||!nodeId||!body.trim()}>{busy?'Posting…':'Post Comment'}</button></div></form>
    {loading?<p role="status">Loading discussions…</p>:<>
      {!threads?.items.length&&<p className="comment-empty">No discussions here yet. Start a review on a saved node.</p>}
      <ul className="comment-thread-list">{threads?.items.map(thread=><li key={thread.id}><button className={'comment-thread'+(selected?.id===thread.id?' is-selected':'')} disabled={busy} aria-pressed={selected?.id===thread.id} onClick={()=>{setSelected(thread);setReplyPage(0);setError('');}}><span className="comment-thread-meta"><strong>{thread.nodeLabel}</strong><span className={'comment-state'+(thread.resolved?' is-resolved':'')}>{thread.resolved?'Resolved':'Open'}</span></span><span className="comment-excerpt">{thread.body}</span><span className="comment-thread-meta">{thread.authorName} · {thread.replyCount} {thread.replyCount===1?'reply':'replies'}</span></button></li>)}</ul>
      {threads&&threads.totalPages>1&&<div className="page-controls"><button disabled={busy||page===0} onClick={()=>setPage(page-1)}>Previous Discussions</button><span>Page {page+1} of {threads.totalPages}</span><button disabled={busy||page+1>=threads.totalPages} onClick={()=>setPage(page+1)}>Next Discussions</button></div>}
    </>}
    {selected&&<section className="comment-detail" aria-label="Discussion Details"><div className="comment-detail-heading"><h3>{selected.nodeLabel}</h3>{canResolve&&<button disabled={busy||replyLoading} onClick={()=>void act(async()=>{const updated=await request<Discussion>(`${base}/${selected.id}`,'PATCH',{version:selected.version,resolved:!selected.resolved});setSelected(updated);setNotice(updated.resolved?'Discussion resolved.':'Discussion reopened.');})}>{selected.resolved?'Reopen Discussion':'Resolve Discussion'}</button>}</div>
      {!nodes.some(node=>node.id===selected.nodeId)&&<p className="hint">This node is absent from your current draft. Its review is retained.</p>}
      <article className="comment-message"><strong>{selected.authorName}</strong><time dateTime={selected.createdAt}>{new Date(selected.createdAt).toLocaleString()}</time><p>{selected.body}</p></article>
      {replyLoading?<p role="status">Loading replies…</p>:<><ol className="comment-replies">{replies?.items.map(item=><li key={item.id} className="comment-message"><strong>{item.authorName}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time><p>{item.body}</p></li>)}</ol>{replies&&replies.totalPages>1&&<div className="page-controls"><button disabled={busy||replyPage===0} onClick={()=>setReplyPage(replyPage-1)}>Previous Replies</button><span>Page {replyPage+1} of {replies.totalPages}</span><button disabled={busy||replyPage+1>=replies.totalPages} onClick={()=>setReplyPage(replyPage+1)}>Next Replies</button></div>}</>}
      {selected.resolved?<p className="hint">Resolved discussions are closed to replies. The author, an Editor or the Owner can reopen them.</p>:<form className="comment-compose" onSubmit={reply}><label htmlFor="comment-reply">Your Reply</label><textarea id="comment-reply" maxLength={1000} required value={drafts[selected.id]??''} disabled={busy} onChange={event=>setDrafts(current=>({...current,[selected.id]:event.target.value}))}/><button className="primary" disabled={busy||replyLoading||!(drafts[selected.id]??'').trim()}>Post Reply</button></form>}
    </section>}
  </Dialog>;
}
