import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Studio from '../app/page';
import EntryFrame from '../app/components/entry-frame';
import ThemeProvider from '../app/components/theme-provider';
import {AccountSession,type Session} from './session';
import type {StandaloneConfig} from '../lib/public-paths';
import '../app/globals.css';import '../app/ekklo.css';import '../app/theme.css';import '../app/entry.css';import './signin.css';
const response=await fetch(new URL('./ekklo-config.json',import.meta.url),{cache:'no-store'});
if(!response.ok)throw new Error('ekklo. configuration could not be loaded.');
const config:StandaloneConfig=await response.json();globalThis.__EKKLO_STANDALONE__=config;
const account=new AccountSession(config),base=new URL(config.appUrl).pathname;
async function transport(session:Session|null){
 const registration=await navigator.serviceWorker.register(base+'sw.js',{scope:base,updateViaCache:'none'});await navigator.serviceWorker.ready;
 if(!navigator.serviceWorker.controller)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Please refresh once to finish opening ekklo..')),10000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});});
 const worker=navigator.serviceWorker.controller||registration.active;if(!worker)throw new Error('Refresh to finish opening ekklo..');
 await new Promise<void>((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(new Error('Refresh to renew your secure connection.')),8000);channel.port1.onmessage=()=>{clearTimeout(timer);channel.port1.close();resolve();};worker.postMessage({type:'EKKLO_ACCESS',access:session?{token:session.access_token,expiresAt:session.expires_at}:null},[channel.port2]);});
}
const accessCopy = {
  signin: { title: 'Sign in to ekklo.', description: 'Open your church publishing workspace.', action: 'Sign in' },
  signup: { title: 'Create your account', description: 'Set up your church publishing workspace.', action: 'Create account' },
  recover: { title: 'Reset your password', description: 'Enter your account email to request a reset link.', action: 'Send reset email' },
  password: { title: 'Choose a new password', description: 'Use at least 8 characters.', action: 'Save password' },
} as const;
type AccessMode = keyof typeof accessCopy;

function Application(){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[mode,setMode]=useState<AccessMode>('signin');
 const [passwordVisible,setPasswordVisible]=useState(false);
 function changeMode(next:AccessMode){setMode(next);setPasswordVisible(false);setError('');setNotice('');}
 async function restore(){try{const next=await account.current();await transport(next);setSession(next);setError('');return true;}catch(e){setSession(account.read());setError((e as Error).message);return false;}finally{setLoading(false);}}
 useEffect(()=>{
 const renew=(event:MessageEvent)=>{
  if(event.data?.type!=='EKKLO_RENEW_ACCESS'||!event.ports[0])return;
  const port=event.ports[0];
  account.current().then(next=>{setSession(next);port.postMessage({access:next?{token:next.access_token,expiresAt:next.expires_at}:null});port.close();},()=>{port.postMessage({error:true});port.close();});
 };
 navigator.serviceWorker.addEventListener('message',renew);
 (async()=>{
  const hash=new URLSearchParams(window.location.hash.slice(1));
  if(hash.get('access_token')&&hash.get('refresh_token')){account.save({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_in:Number(hash.get('expires_in')||3600)});if(hash.get('type')==='recovery')setMode('password');history.replaceState({},'',base+window.location.search);}
  if(new URLSearchParams(location.search).has('logout')){await account.signOut();history.replaceState({},'',base);}
  await restore();
 })();
 const resume=async()=>{if(document.visibilityState==='visible'&&await restore())window.dispatchEvent(new Event('ekklo:session-ready'));};
 const timer=setInterval(()=>{void restore();},45000);
 const storage=(e:StorageEvent)=>{if(e.key===account.storageKey)void resume();};
 window.addEventListener('storage',storage);window.addEventListener('focus',resume);window.addEventListener('online',resume);window.addEventListener('pageshow',resume);document.addEventListener('visibilitychange',resume);
 return()=>{clearInterval(timer);navigator.serviceWorker.removeEventListener('message',renew);window.removeEventListener('storage',storage);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);window.removeEventListener('pageshow',resume);document.removeEventListener('visibilitychange',resume);};},[]);
 useEffect(()=>{const click=async(event:MouseEvent)=>{
  const anchor=(event.target as Element)?.closest?.('a');if(!anchor||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const url=new URL(anchor.href,location.href);if(url.origin!==location.origin)return;
  if(url.pathname==='/signin-with-chatgpt'){event.preventDefault();location.assign(config.appUrl);return;}
  if(url.pathname==='/signout-with-chatgpt'){event.preventDefault();await account.signOut();await transport(null);setSession(null);history.replaceState({},'',base);return;}
  if(url.pathname==='/'&&(url.search||url.hash)){event.preventDefault();location.assign(base+url.search+url.hash);return;}
  if(url.pathname.startsWith('/api/'))anchor.href=base+url.pathname.slice(1)+url.search+url.hash;
 };document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true);},[]);
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget),email=String(data.get('email')||'').trim(),password=String(data.get('password')||'');setBusy(true);setPasswordVisible(false);setError('');setNotice('');
  try{if(mode==='recover'){await account.recover(email);setNotice('If an account exists, a password reset email is on its way.');return;}
   if(mode==='password'){await account.changePassword(password);setMode('signin');setNotice('Your password has been updated.');}
   else{const next=mode==='signup'?await account.signUp(email,password):await account.signIn(email,password);if(!next){setNotice('Check your email to confirm your account, then sign in.');return;}}
   await restore();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 if(loading)return (
  <EntryFrame assetBase={base}>
   <h1 id="entry-title">Opening your workspace</h1>
   <p className="entry-description" role="status">Checking your account session…</p>
  </EntryFrame>
 );
 if(session&&mode!=='password')return <>{error&&<div className="standalone-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss">×</button></div>}<Studio/></>;

 const copy=accessCopy[mode];
 return (
  <EntryFrame assetBase={base}>
   <h1 id="entry-title">{copy.title}</h1>
   <p className="entry-description">{copy.description}</p>
   <form className="entry-form" aria-busy={busy} onSubmit={submit}>
    {mode!=='password'&&(
     <div className="entry-control">
      <label htmlFor="entry-email">Email address</label>
      <input id="entry-email" name="email" type="email" autoComplete={mode==='signin'?'username':'email'} placeholder="you@example.com" required />
     </div>
    )}
    {mode!=='recover'&&(
     <div className="entry-control" key={mode}>
      <label htmlFor="entry-password">{mode==='password'?'New password':'Password'}</label>
      <div className="entry-password">
       <input id="entry-password" name="password" type={passwordVisible?'text':'password'} minLength={mode==='signin'?1:8} autoComplete={mode==='signin'?'current-password':'new-password'} required />
       <button className="entry-reveal" type="button" aria-label={passwordVisible?'Hide password':'Show password'} aria-pressed={passwordVisible} disabled={busy} onClick={()=>setPasswordVisible(visible=>!visible)}>{passwordVisible?'Hide':'Show'}</button>
      </div>
     </div>
    )}
    {error&&<p className="entry-feedback error" role="alert">{error}</p>}
    {notice&&<p className="entry-feedback notice" role="status">{notice}</p>}
    <button className="entry-primary" type="submit" disabled={busy}>{busy?'Please wait…':copy.action}</button>
   </form>
   <div className="entry-actions">
    {mode==='signin'?(
     <>
      <button className="entry-text-action" type="button" disabled={busy} onClick={()=>changeMode('signup')}>Create an account</button>
      <button className="entry-text-action" type="button" disabled={busy} onClick={()=>changeMode('recover')}>Forgot password?</button>
     </>
    ):(
     <button className="entry-text-action" type="button" disabled={busy} onClick={()=>changeMode('signin')}>Back to sign in</button>
    )}
   </div>
  </EntryFrame>
 );
}
createRoot(document.getElementById('root')!).render(<ThemeProvider><Application/></ThemeProvider>);
