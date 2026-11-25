import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Studio from '../app/page';
import ThemeProvider from '../app/components/theme-provider';
import {AccountSession,type Session} from './session';
import type {StandaloneConfig} from '../lib/public-paths';
import '../app/globals.css';import '../app/ekklo.css';import '../app/theme.css';import './signin.css';
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
function Shell({children}:{children:React.ReactNode}){return <div className="ekklo-signin"><div className="ekklo-signin-card"><div className="signin-brand"><img src={base+'ekklo-mark.png'} alt=""/><span>ekklo<span>.</span></span></div><p className="signin-tagline">ONE CHURCH. EVERY PLATFORM.</p>{children}</div></div>;}
function Application(){
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[mode,setMode]=useState<'signin'|'signup'|'recover'|'password'>('signin');
 async function restore(){try{const next=await account.current();await transport(next);setSession(next);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{(async()=>{
  const hash=new URLSearchParams(window.location.hash.slice(1));
  if(hash.get('access_token')&&hash.get('refresh_token')){account.save({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_in:Number(hash.get('expires_in')||3600)});if(hash.get('type')==='recovery')setMode('password');history.replaceState({},'',base+window.location.search);}
  if(new URLSearchParams(location.search).has('logout')){await account.signOut();history.replaceState({},'',base);}
  await restore();
 })();const timer=setInterval(()=>{account.current().then(async s=>{await transport(s);setSession(s);}).catch(()=>{});},45000);const storage=(e:StorageEvent)=>{if(e.key===account.storageKey)restore();};window.addEventListener('storage',storage);return()=>{clearInterval(timer);window.removeEventListener('storage',storage);};},[]);
 useEffect(()=>{const click=async(event:MouseEvent)=>{
  const anchor=(event.target as Element)?.closest?.('a');if(!anchor||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const url=new URL(anchor.href,location.href);if(url.origin!==location.origin)return;
  if(url.pathname==='/signin-with-chatgpt'){event.preventDefault();location.assign(config.appUrl);return;}
  if(url.pathname==='/signout-with-chatgpt'){event.preventDefault();await account.signOut();await transport(null);setSession(null);history.replaceState({},'',base);return;}
  if(url.pathname==='/'&&(url.search||url.hash)){event.preventDefault();location.assign(base+url.search+url.hash);return;}
  if(url.pathname.startsWith('/api/'))anchor.href=base+url.pathname.slice(1)+url.search+url.hash;
 };document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true);},[]);
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget),email=String(data.get('email')||'').trim(),password=String(data.get('password')||'');setBusy(true);setError('');setNotice('');
  try{if(mode==='recover'){await account.recover(email);setNotice('If an account exists, a password reset email is on its way.');return;}
   if(mode==='password'){await account.changePassword(password);setMode('signin');setNotice('Your password has been updated.');}
   else{const next=mode==='signup'?await account.signUp(email,password):await account.signIn(email,password);if(!next){setNotice('Check your email to confirm your account, then sign in.');return;}}
   await restore();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 if(loading)return <Shell><h1>Opening your workspace…</h1><p>Connecting your account securely.</p></Shell>;
 if(session&&mode!=='password')return <>{error&&<div className="standalone-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss">×</button></div>}<Studio/></>;
 return <Shell><h1>{mode==='signup'?'Welcome to ekklo.':mode==='recover'?'Reset your password':mode==='password'?'Choose a new password':'Welcome back.'}</h1><p>{mode==='signup'?'Create your church publishing workspace.':'Sign in to plan, create, and publish for your church.'}</p><form onSubmit={submit}>{mode!=='password'&&<label>Email<input name="email" type="email" autoComplete="email" required/></label>}{mode!=='recover'&&<label>Password<input name="password" type="password" minLength={mode==='signin'?1:8} autoComplete={mode==='signin'?'current-password':'new-password'} required/></label>}{error&&<p className="signin-error" role="alert">{error}</p>}{notice&&<p className="signin-notice" role="status">{notice}</p>}<button className="btn primary full" disabled={busy}>{busy?'Please wait…':mode==='signup'?'Create account':mode==='recover'?'Send reset email':mode==='password'?'Save password':'Sign in'}</button></form><div className="signin-actions">{mode==='signin'?<><button onClick={()=>{setMode('signup');setError('');setNotice('');}}>Create an account</button><button onClick={()=>{setMode('recover');setError('');setNotice('');}}>Forgot password?</button></>:<button onClick={()=>{setMode('signin');setError('');setNotice('');}}>Back to sign in</button>}</div></Shell>;
}
createRoot(document.getElementById('root')!).render(<ThemeProvider><Application/></ThemeProvider>);
