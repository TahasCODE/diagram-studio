import {useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import {request} from '../lib/api';
import type {ProjectRole} from '../lib/api';
import {Dialog} from './Dialog';
import '../styles/collaboration.css';

interface Member {id:string;name:string;email:string;role:ProjectRole;accepted:boolean}
interface Invitation {projectId:string;title:string;ownerName:string;role:ProjectRole}
interface Project {id:string;title:string;role:ProjectRole}
interface Props {project:Project|null;onClose:()=>void;onOpen:(id:string)=>void}
const label=(role:ProjectRole)=>role[0]+role.slice(1).toLowerCase();
export function Collaboration({project,onClose,onOpen}:Props){
  const [members,setMembers]=useState<Member[]>([]),[invitations,setInvitations]=useState<Invitation[]>([]);
  const [accepted,setAccepted]=useState<Invitation[]>([]);
  const [email,setEmail]=useState(''),[role,setRole]=useState<'EDITOR'|'VIEWER'>('VIEWER');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const owner=project?.role==='OWNER';
  async function refresh(){
    const [inbox,people]=await Promise.all([request<Invitation[]>('/invitations'),owner?request<Member[]>(`/projects/${project!.id}/members`):Promise.resolve([])]);
    setInvitations(inbox);setMembers(people);
  }
  useEffect(()=>{let cancelled=false;setLoading(true);
    Promise.all([request<Invitation[]>('/invitations'),owner?request<Member[]>(`/projects/${project!.id}/members`):Promise.resolve([])])
      .then(([inbox,people])=>{if(!cancelled){setInvitations(inbox);setMembers(people);}})
      .catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[project?.id,owner]);
  async function act(action:()=>Promise<unknown>,success:string){
    if(busy)return;setBusy(true);setError('');setMessage('');
    try{await action();setMessage(success);await refresh();}catch(e){setError(e instanceof Error?e.message:'Could not update project access.');}finally{setBusy(false);}
  }
  function invite(e:FormEvent){e.preventDefault();void act(async()=>{await request(`/projects/${project!.id}/members`,'POST',{email,role});setEmail('');},'Invitation sent to their in-app inbox. Access begins only after acceptance.');}
  return <Dialog title="Project Collaboration" onClose={()=>{if(!busy)onClose();}}>
    <p className="dialog-copy">Share a saved project with existing verified accounts. Changes are saved explicitly; simultaneous live editing and email invitations are not included.</p>
    {loading&&<p role="status">Loading project access…</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p role="status" className="collaboration-message">{message}</p>}
    {!loading&&<>
      {project?<section className="collaboration-section"><h3>{project.title}</h3><p className="hint">Your access: <strong>{label(project.role)}</strong>. Owners manage members, publish and delete. Editors save and restore. Viewers open and play.</p>
        {owner&&<><form onSubmit={invite} className="collaboration-invite"><label htmlFor="member-email">Invite by Account Email</label><input id="member-email" type="email" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy} autoComplete="off"/><label htmlFor="member-role">Project Role</label><select id="member-role" value={role} onChange={e=>setRole(e.target.value as 'EDITOR'|'VIEWER')} disabled={busy}><option value="VIEWER">Viewer — open and play</option><option value="EDITOR">Editor — save and restore</option></select><button className="primary" type="submit" disabled={busy}>{busy?'Updating…':'Send Invitation'}</button></form>
        <ul className="collaboration-list">{members.map(member=><li key={member.id}><div><strong>{member.name}</strong><span>{member.email}</span><small>{label(member.role)} · {member.accepted?'Active':'Invitation pending'}</small></div>{member.role!=='OWNER'&&<div className="collaboration-actions"><button disabled={busy} aria-label={`Make ${member.name} ${member.role==='EDITOR'?'Viewer':'Editor'}`} onClick={()=>void act(()=>request(`/projects/${project.id}/members/${member.id}`,'PATCH',{role:member.role==='EDITOR'?'VIEWER':'EDITOR'}),'Project role updated. Future requests use the new permission.')}>{member.role==='EDITOR'?'Make Viewer':'Make Editor'}</button><button className="danger" disabled={busy} aria-label={`Remove ${member.name}`} onClick={()=>void act(()=>request(`/projects/${project.id}/members/${member.id}`,'DELETE'),'Access removed. Previously downloaded copies cannot be recalled.')}>Remove</button></div>}</li>)}</ul></>}
      </section>:<p className="hint">Save a project online, then use Manage Access in My Projects to invite members.</p>}
      <section className="collaboration-section"><h3>Your Invitations</h3><p className="hint">Invitations appear here when an owner enters your verified account email. No email message is sent.</p>
        {!invitations.length&&<p className="hint">No pending invitations.</p>}
        <ul className="collaboration-list">{invitations.map(invite=><li key={invite.projectId}><div><strong>{invite.title}</strong><span>From {invite.ownerName} · {label(invite.role)}</span></div><div className="collaboration-actions"><button disabled={busy} onClick={()=>void act(async()=>{await request(`/invitations/${invite.projectId}/accept`,'POST');setAccepted(items=>[...items,invite]);},'Invitation accepted. The project is now in My Projects.')}>Accept</button><button disabled={busy} onClick={()=>void act(()=>request(`/invitations/${invite.projectId}`,'DELETE'),'Invitation declined.')}>Decline</button></div></li>)}</ul>
        {accepted.map(item=><p key={item.projectId}><button disabled={busy} onClick={()=>onOpen(item.projectId)}>Open {item.title}</button></p>)}
      </section>
    </>}
  </Dialog>;
}
