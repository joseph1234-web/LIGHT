import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';

await mkdir('.sites-runtime/session',{recursive:true});
await build({entryPoints:['github-pages/session.ts'],outfile:'.sites-runtime/session/session.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {AccountSession}=await import('../.sites-runtime/session/session.mjs');
class MemoryStorage {
 values=new Map();
 getItem(key){return this.values.get(key)??null;}
 setItem(key,value){this.values.set(key,String(value));}
 removeItem(key){this.values.delete(key);}
}
const config={supabaseUrl:'https://account.example.test',publishableKey:'sb_publishable_fixture',appUrl:'https://church.example.test/LIGHT/',apiBase:'https://account.example.test/functions/v1/ekklo-api/api'};
const originalFetch=globalThis.fetch,calls=[];
let rejectLogin=false;
// Browser host functions require the Window/global receiver. An injected arrow
// fetch would hide the illegal-invocation failure seen in the real sign-in form.
globalThis.fetch=async function(input,init){
 assert.equal(this,globalThis,'Browser fetch must retain its global receiver.');
 const url=new URL(input),body=JSON.parse(init.body);
 assert.equal(url.origin,config.supabaseUrl);
 assert.equal(init.headers.apikey,config.publishableKey);
 assert.equal(init.credentials,'omit');
 calls.push({url,body,method:init.method,headers:init.headers});
 if(url.pathname.endsWith('/token')){
  if(rejectLogin)return Response.json({msg:'Invalid login credentials'},{status:400});
  return Response.json({access_token:url.searchParams.get('grant_type')==='refresh_token'?'refreshed-access':'signed-in-access',refresh_token:'fixture-refresh',expires_in:3600,user:{id:'fixture-user',email:'church@example.test'}});
 }
 if(url.pathname.endsWith('/signup'))return Response.json({user:{id:'new-user'}});
 if(url.pathname.endsWith('/recover'))return Response.json({});
 if(url.pathname.endsWith('/user')){assert.equal(init.headers.Authorization,'Bearer refreshed-access');return Response.json({id:'fixture-user'});}
 if(url.pathname.endsWith('/logout'))return new Response(null,{status:204});
 throw new Error('Unexpected account endpoint.');
};
try {
 const storage=new MemoryStorage(),account=new AccountSession(config,storage);
 const signedIn=await account.signIn('church@example.test','fixture-password');
 assert.equal(signedIn.access_token,'signed-in-access');
 assert.equal(account.read().user.email,'church@example.test');
 assert.deepEqual(calls[0].body,{email:'church@example.test',password:'fixture-password'});
 assert.equal(calls[0].url.searchParams.get('grant_type'),'password');
 account.save({...signedIn,expires_at:1});
 assert.equal((await account.current()).access_token,'refreshed-access');
 assert.equal(calls[1].url.searchParams.get('grant_type'),'refresh_token');
 assert.deepEqual(calls[1].body,{refresh_token:'fixture-refresh'});
 await account.changePassword('new-fixture-password');
 assert.equal(calls.at(-1).method,'PUT');
 assert.deepEqual(calls.at(-1).body,{password:'new-fixture-password'});
 await account.recover('church@example.test');
 assert.equal(calls.at(-1).url.searchParams.get('redirect_to'),config.appUrl);
 const pending=new AccountSession(config,new MemoryStorage());
 assert.equal(await pending.signUp('new@example.test','fixture-password'),null);
 assert.equal(pending.read(),null,'Email confirmation must still be required.');
 assert.equal(calls.at(-1).url.searchParams.get('redirect_to'),config.appUrl);
 await account.signOut();
 assert.equal(account.read(),null);
 assert.equal(calls.at(-1).url.pathname,'/auth/v1/logout');
 rejectLogin=true;
 await assert.rejects(()=>account.signIn('church@example.test','invalid-fixture'),/Invalid login credentials/);
 assert.equal(account.read(),null);
 Object.defineProperty(navigator,'onLine',{value:true,configurable:true});
 const expired={access_token:'old-access',refresh_token:'saved-refresh',expires_at:1};
 for(const request of [
  async()=>{throw new TypeError('Failed to fetch');},
  async()=>Response.json({message:'Temporarily unavailable'},{status:503}),
  async()=>Response.json({message:'Too many requests'},{status:429}),
  async()=>new Response('Upstream unavailable',{status:502}),
  async()=>Response.json({expires_in:3600})
 ]){
  const saved=new AccountSession(config,new MemoryStorage(),request);saved.save(expired);
  await assert.rejects(()=>saved.current());
  assert.equal(saved.read()?.refresh_token,expired.refresh_token,'A temporary refresh failure must preserve sign-in for a later retry.');
 }
 for(const code of ['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired']){
  const revoked=new AccountSession(config,new MemoryStorage(),async()=>Response.json({code,msg:'Session ended'},{status:400}));revoked.save(expired);
  assert.equal(await revoked.current(),null,'A confirmed revoked session requires sign-in.');
  assert.equal(revoked.read(),null);
 }
 let completeRefresh,refreshCalls=0;
 const delayed=new AccountSession(config,new MemoryStorage(),async()=>{refreshCalls++;return new Promise(resolve=>{completeRefresh=resolve;});});
 delayed.save(expired);const waiting=delayed.current(),sameRefresh=delayed.current();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(refreshCalls,1,'Concurrent requests must share one refresh.');
 completeRefresh(Response.json({access_token:'renewed-access',refresh_token:'rotated-refresh',expires_in:3600}));
 assert.equal((await waiting).access_token,'renewed-access');await sameRefresh;
 const reopened=new AccountSession(config,delayed.storage,async()=>{throw new Error('A saved current session needs no new login.');});
 assert.equal((await reopened.current()).refresh_token,'rotated-refresh','Closing and reopening must restore the persisted session.');
 delayed.save(expired);const duringSignOut=delayed.current();await new Promise(resolve=>setImmediate(resolve));
 delayed.storage.removeItem(delayed.storageKey);
 completeRefresh(Response.json({access_token:'late-access',refresh_token:'late-refresh',expires_in:3600}));
 assert.equal(await duringSignOut,null,'A late refresh must not undo sign-out.');assert.equal(delayed.read(),null);
 delayed.save(expired);const olderLogin=delayed.current();await new Promise(resolve=>setImmediate(resolve));
 delayed.save({access_token:'new-account-access',refresh_token:'new-account-refresh',expires_in:3600});
 completeRefresh(Response.json({code:'refresh_token_already_used',msg:'Session ended'},{status:400}));
 assert.equal((await olderLogin).refresh_token,'new-account-refresh','An old refresh must not delete a newer sign-in.');
 console.log('Account sign-in, persistent reopening, transient recovery, token rotation, concurrent refresh, and sign-out isolation passed.');
} finally {globalThis.fetch=originalFetch;}

