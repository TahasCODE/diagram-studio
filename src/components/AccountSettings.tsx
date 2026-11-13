import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Account } from '../lib/api';
import { request } from '../lib/api';
import { Dialog } from './Dialog';

export function AccountSettings({account,onClose,onProfile,onSignedOut,onSignOut}:{account:Account;onClose:()=>void;onProfile:(account:Account)=>void;onSignedOut:(message:string)=>void;onSignOut:()=>void}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [name,setName]=useState(account.name);
  const [events,setEvents]=useState<{action:string;createdAt:string}[]>([]);
  const [eventError,setEventError]=useState('');
  const loadEvents=()=>request<typeof events>('/auth/security-events').then(setEvents).catch(()=>setEventError('Security activity is unavailable.'));
  useEffect(()=>{void loadEvents();},[]);
  async function saveProfile(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setMessage('');
    try{onProfile(await request<Account>('/auth/profile','PUT',{name}));setMessage('Your profile has been updated.');void loadEvents();}
    catch(error){setError(error instanceof Error?error.message:'Could not update your profile.');}finally{setBusy(false);}
  }
  async function changePassword(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget);
    if(form.get('newPassword')!==form.get('confirmPassword')){setError('The new passwords do not match.');return;}
    setBusy(true);setError('');setMessage('');
    try{await request('/auth/change-password','POST',{currentPassword:form.get('currentPassword'),newPassword:form.get('newPassword')});onSignedOut('Password changed successfully. All sessions have been signed out. Sign in with your new password.');}
    catch(error){setError(error instanceof Error?error.message:'Could not change your password.');}finally{setBusy(false);}
  }
  async function signOutAll(){
    setBusy(true);setError('');
    try{await request('/auth/logout-all','POST');onSignedOut('All sessions have been signed out. Your local diagram is still available.');}
    catch(error){setError(error instanceof Error?error.message:'Could not sign out sessions.');}finally{setBusy(false);}
  }
  return <Dialog title="Account Settings" onClose={()=>{if(!busy)onClose();}}>
    <p className="dialog-copy">Manage your profile and protect your private workspace.</p>
    <div className="account-identity"><strong>{account.email}</strong><span className="verified-badge">Email Verified</span></div>
    {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="auth-created" role="status">{message}</p>}
    <section className="account-section"><h3>Profile</h3><form onSubmit={saveProfile} aria-busy={busy}><fieldset disabled={busy}><label htmlFor="profile-name">Display Name</label><input id="profile-name" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} maxLength={80} required/><button type="submit" disabled={busy||name.trim()===account.name}>Save Profile</button></fieldset></form></section>
    <section className="account-section"><h3>Change Password</h3><p className="hint">Use at least 10 characters. Changing your password signs out every session, including this one. Your local diagram stays on this device.</p><form onSubmit={changePassword} aria-busy={busy}><fieldset disabled={busy}>
      <label htmlFor="current-password">Current Password</label><input id="current-password" name="currentPassword" type="password" autoComplete="current-password" maxLength={72} required/>
      <label htmlFor="new-password">New Password</label><input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={72} required/>
      <label htmlFor="confirm-password">Confirm New Password</label><input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={72} required/>
      <button className="primary" disabled={busy} type="submit">{busy&&<span className="loading-spinner" aria-hidden="true"/>}Change Password</button>
    </fieldset></form></section>
    <section className="account-section"><h3>Sessions</h3><p className="hint">Sign out everywhere if you used a shared computer or suspect unauthorized access. This includes your current session.</p><div className="actions"><button disabled={busy} onClick={signOutAll}>Sign Out All Devices</button><button disabled={busy} onClick={onSignOut}>Sign Out</button></div></section>
    <section className="account-section"><h3>Recent Security Activity</h3>{eventError&&<p className="hint">{eventError}</p>}{!events.length&&!eventError&&<p className="hint">No account changes recorded yet.</p>}<ul className="activity-list">{events.map((event,index)=><li key={index}><strong>{event.action.split('_').map(word=>word.charAt(0)+word.slice(1).toLowerCase()).join(' ')}</strong><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></li>)}</ul></section>
  </Dialog>;
}
