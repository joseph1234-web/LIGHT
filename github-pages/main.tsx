import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Studio from '../app/page';
import EntryFrame from '../app/components/entry-frame';
import ThemeProvider from '../app/components/theme-provider';
import {AccountSession,type Session} from './session';
import {fetchPresenterInstaller} from './presenter-download';
import {presenterPlatform,presenterReleases,type PresenterPlatform} from '../lib/presenter-releases';
import type {StandaloneConfig} from '../lib/public-paths';
import '../app/globals.css';import '../app/ekklo.css';import '../app/theme.css';import '../app/entry.css';import './signin.css';
const response=await fetch(new URL('./ekklo-config.json',import.meta.url),{cache:'no-store'});
if(!response.ok)throw new Error('ekklo. configuration could not be loaded.');
const config:StandaloneConfig=await response.json();globalThis.__EKKLO_STANDALONE__=config;
const account=new AccountSession(config),base=new URL(config.appUrl).pathname;
const accountReturnKey=account.storageKey+':presenter';
function hasWorkspaceRequest(params=new URLSearchParams(location.search)){
 return params.get('workspace')==='1'||params.has('view');
}
function rememberDownload(platform:PresenterPlatform|null){
 if(platform)localStorage.setItem(accountReturnKey,JSON.stringify({platform,expires:Date.now()+86_400_000}));
 else localStorage.removeItem(accountReturnKey);
}
function takeRememberedDownload(){
 const stored=localStorage.getItem(accountReturnKey);
 localStorage.removeItem(accountReturnKey);
 try{
  const value=JSON.parse(stored||'null');
  return value?.expires>Date.now()?presenterPlatform(value.platform):null;
 }catch{return null;}
}
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

function DownloadReady({platform}:{platform:PresenterPlatform}){
 const release=presenterReleases[platform];
 const [progress,setProgress]=useState<number|null>(null);
 const [download,setDownload]=useState('');
 const [error,setError]=useState('');
 const active=useRef<AbortController|null>(null);

 useEffect(()=>()=>active.current?.abort(),[]);
 useEffect(()=>()=>{if(download)URL.revokeObjectURL(download);},[download]);

 async function startDownload(){
  if(active.current)return;
  const controller=new AbortController();
  active.current=controller;
  setDownload('');
  setError('');
  setProgress(0);
  try{
   const session=await account.current();
   const blob=await fetchPresenterInstaller(config,platform,session?.access_token||'',setProgress,controller.signal);
   if(controller.signal.aborted)return;
   const href=URL.createObjectURL(blob);
   setDownload(href);
   const link=document.createElement('a');
   link.href=href;
   link.download=release.fileName;
   document.body.appendChild(link);
   link.click();
   link.remove();
  }catch(error){
   if(!controller.signal.aborted)setError(error instanceof Error?error.message:'The download could not be completed. Please try again.');
  }finally{
   active.current=null;
   if(!controller.signal.aborted)setProgress(null);
  }
 }

 return (
  <EntryFrame assetBase={base}>
   <h1 id="entry-title">{release.platform} download</h1>
   <p className="entry-description">Ekklo. Worship Presenter {release.version} · {release.format} · {Math.round(release.bytes/1_000_000)} MB</p>
   <div className="entry-ready">
    {error&&<p className="entry-feedback error" role="alert">{error}</p>}
    {download?(
     <>
      <p className="entry-feedback notice" role="status">Your file is ready. Use the button below if it didn’t start automatically.</p>
      <a className="entry-primary" href={download} download={release.fileName}>Save {release.platform} file</a>
     </>
    ):(
     <button className="entry-primary" type="button" disabled={progress!==null} onClick={startDownload}>
      {progress===null?'Download for '+release.platform:'Preparing download… '+progress+'%'}
     </button>
    )}
    {progress!==null&&<progress aria-label="Download progress" value={progress} max={100} />}
   </div>
   <div className="entry-actions">
    <a className="entry-text-action entry-back" href={base}>Back to welcome</a>
    <a className="entry-text-action entry-back" href={base+'?download='+platform+'&logout=1'}>Use another account</a>
   </div>
  </EntryFrame>
 );
}

function Application(){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[mode,setMode]=useState<AccessMode>('signin');
 const [passwordVisible,setPasswordVisible]=useState(false);
 const params=new URLSearchParams(location.search);
 const platform=presenterPlatform(params.get('download'));
 const workspaceRequested=hasWorkspaceRequest(params);
 const workspaceHref=base+'?workspace=1';
 function changeMode(next:AccessMode){setMode(next);setPasswordVisible(false);setError('');setNotice('');}
 async function restore(){try{const next=await account.current();if(hasWorkspaceRequest())await transport(next);setSession(next);return true;}catch(e){setSession(account.read());setError((e as Error).message);return false;}finally{setLoading(false);}}
 useEffect(()=>{
 const renew=(event:MessageEvent)=>{
  if(event.data?.type!=='EKKLO_RENEW_ACCESS'||!event.ports[0])return;
  const port=event.ports[0];
  account.current().then(next=>{setSession(next);port.postMessage({access:next?{token:next.access_token,expiresAt:next.expires_at}:null});port.close();},()=>{port.postMessage({error:true});port.close();});
 };
 navigator.serviceWorker?.addEventListener('message',renew);
 (async()=>{
  const hash=new URLSearchParams(window.location.hash.slice(1));
  const search=new URLSearchParams(location.search);
  if(hash.get('access_token')&&hash.get('refresh_token')){
   account.save({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_in:Number(hash.get('expires_in')||3600)});
   if(hash.get('type')==='recovery')setMode('password');
   const savedPlatform=takeRememberedDownload();
   if(!presenterPlatform(search.get('download'))&&!hasWorkspaceRequest(search)){
    if(savedPlatform)search.set('download',savedPlatform);
    else search.set('workspace','1');
   }
   history.replaceState({},'',base+'?'+search);
  }
  if(search.has('logout')){
   await account.signOut();
   if(navigator.serviceWorker?.controller)await transport(null).catch(()=>undefined);
   search.delete('logout');
   history.replaceState({},'',base+(search.size?'?'+search:''));
  }
  await restore();
 })();
 const resume=async()=>{if(document.visibilityState==='visible'&&await restore())window.dispatchEvent(new Event('ekklo:session-ready'));};
 const timer=setInterval(()=>{void restore();},45000);
 const storage=(e:StorageEvent)=>{if(e.key===account.storageKey)void resume();};
 window.addEventListener('storage',storage);window.addEventListener('focus',resume);window.addEventListener('online',resume);window.addEventListener('pageshow',resume);document.addEventListener('visibilitychange',resume);
 return()=>{clearInterval(timer);navigator.serviceWorker?.removeEventListener('message',renew);window.removeEventListener('storage',storage);window.removeEventListener('focus',resume);window.removeEventListener('online',resume);window.removeEventListener('pageshow',resume);document.removeEventListener('visibilitychange',resume);};},[]);
 useEffect(()=>{const click=async(event:MouseEvent)=>{
  const anchor=(event.target as Element)?.closest?.('a');if(!anchor||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const url=new URL(anchor.href,location.href);if(url.origin!==location.origin)return;
  if(url.pathname==='/signin-with-chatgpt'){event.preventDefault();location.assign(workspaceHref);return;}
  if(url.pathname==='/signout-with-chatgpt'){event.preventDefault();location.assign(base+'?logout=1');return;}
  if(url.pathname==='/'&&(url.search||url.hash)){event.preventDefault();location.assign(base+url.search+url.hash);return;}
  if(url.pathname.startsWith('/api/'))anchor.href=base+url.pathname.slice(1)+url.search+url.hash;
 };document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true);},[]);
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget),email=String(data.get('email')||'').trim(),password=String(data.get('password')||'');setBusy(true);setPasswordVisible(false);setError('');setNotice('');
  try{if(mode==='recover'){rememberDownload(platform);await account.recover(email);setNotice('If an account exists, a password reset email is on its way.');return;}
   if(mode==='password'){await account.changePassword(password);setMode('signin');setNotice('Your password has been updated.');}
   else{
    if(mode==='signup')rememberDownload(platform);
    const next=mode==='signup'?await account.signUp(email,password):await account.signIn(email,password);
    if(!next){setNotice('Check your email to confirm your account, then sign in.');return;}
    rememberDownload(null);
   }
   await restore();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 if(!platform&&!workspaceRequested&&mode!=='password')return (
  <EntryFrame assetBase={base} welcome presenterHome={config.appUrl}>
   <h2 id="workspace-title">Church workspace</h2>
   <p className="entry-description">Plan Bible verse posts, Sunday invitations, and church announcements.</p>
   <a className="entry-primary" href={workspaceHref}>Open church workspace</a>
  </EntryFrame>
 );
 if(loading)return (
  <EntryFrame assetBase={base}>
   <h1 id="entry-title">{platform?'Opening your download':'Opening your workspace'}</h1>
   <p className="entry-description" role="status">Checking your account session…</p>
  </EntryFrame>
 );
 if(session&&mode!=='password'){
  if(platform)return <DownloadReady platform={platform}/>;
  return <>{error&&<div className="standalone-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss">×</button></div>}<Studio/></>;
 }

 const copy=accessCopy[mode];
 const release=platform?presenterReleases[platform]:null;
 const title=mode==='signin'&&release?'Sign in to download':copy.title;
 const description=release&&(mode==='signin'||mode==='signup')
  ?mode==='signin'
   ?'Use your Gmail or email address and Ekklo password to download Worship Presenter for '+release.platform+'.'
   :'Use your email address and create an Ekklo password to get Worship Presenter for '+release.platform+'.'
  :copy.description;
 return (
  <EntryFrame assetBase={base}>
   <h1 id="entry-title">{title}</h1>
   <p className="entry-description">{description}</p>
   <form className="entry-form" aria-busy={busy} onSubmit={submit}>
    {mode!=='password'&&(
     <div className="entry-control">
      <label htmlFor="entry-email">{release?'Gmail or email address':'Email address'}</label>
      <input id="entry-email" name="email" type="email" autoComplete={mode==='signin'?'username':'email'} placeholder={release?'you@gmail.com':'you@example.com'} required />
     </div>
    )}
    {mode!=='recover'&&(
     <div className="entry-control" key={mode}>
      <label htmlFor="entry-password">{mode==='password'?'New password':release?'Ekklo password':'Password'}</label>
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
   <a className="entry-text-action entry-back" href={base}>Back to welcome</a>
  </EntryFrame>
 );
}
createRoot(document.getElementById('root')!).render(<ThemeProvider><Application/></ThemeProvider>);
