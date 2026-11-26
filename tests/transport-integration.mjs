import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {MessageChannel} from 'node:worker_threads';
import {build} from 'esbuild';

await build({entryPoints:['github-pages/session.ts'],outfile:'.sites-runtime/session/transport-session.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {AccountSession}=await import('../.sites-runtime/session/transport-session.mjs');
const config={supabaseUrl:'https://fixtureproject.supabase.co',publishableKey:'sb_publishable_fixture',appUrl:'https://church.example.test/LIGHT/',apiBase:'https://fixtureproject.supabase.co/functions/v1/ekklo-api/api'};
const source=await readFile('github-pages/sw.js','utf8'),listeners=new Map(),values=new Map();
const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
let refreshCalls=0,failRefresh=false,apiCalls=0,renewals=0,openTab=true,clientUrl=config.appUrl,lastRequest;
const account=new AccountSession(config,storage,async()=>{refreshCalls++;if(failRefresh)throw new TypeError('Connection interrupted');return Response.json({access_token:'renewed-access',refresh_token:'rotated-refresh',expires_in:3600});});
account.save({access_token:'old-access',refresh_token:'private-page-refresh',expires_at:1});
let access={token:'old-access',expiresAt:1};
const client={id:'tab',get url(){return clientUrl;},postMessage(message,ports){renewals++;assert.equal(message.type,'EKKLO_RENEW_ACCESS');account.current().then(session=>ports[0].postMessage({access:session?{token:session.access_token,expiresAt:session.expires_at}:null}),()=>ports[0].postMessage({error:true}));}};
const indexedDB={open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const tx={objectStore(){return {get(){return result(access);},put(value){access=value;return result(undefined);}};}};function result(value){const item={result:value};queueMicrotask(()=>tx.oncomplete?.());return item;}return tx;}};request.onsuccess();});return request;}};
const self={registration:{scope:config.appUrl},clients:{get:async id=>openTab&&id==='tab'?client:null,matchAll:async()=>openTab?[client]:[]},addEventListener:(name,handler)=>listeners.set(name,handler)};
runInNewContext(source,{self,indexedDB,URL,Request,Response,Headers,MessageChannel,Promise,Number,Date,setTimeout,clearTimeout,fetch:async(input,init)=>{
 const url=new URL(input);if(url.pathname.endsWith('ekklo-config.json'))return Response.json(config);
 assert.equal(url.origin,new URL(config.apiBase).origin);apiCalls++;lastRequest={url,init};
 assert.equal(init.headers.get('Authorization'),'Bearer renewed-access');
 assert.equal(init.headers.get('cookie'),null);assert.equal(init.headers.get('oai-authenticated-user-id'),null);
 assert.equal(init.credentials,'omit');return Response.json({connections:[{platform:'facebook',label:'Saved church Page'}]});
}});
async function request(method='GET'){
 let response;listeners.get('fetch')({clientId:'tab',request:new Request(config.appUrl+'api/state',{method,headers:{cookie:'private-cookie','oai-authenticated-user-id':'spoofed-owner'},...(method==='POST'?{body:'{"save":true}'}:{})}),respondWith:value=>{response=value;}});return response;
}
let response=await request();
assert.equal(response.status,200,'An expired tab must renew before its first API request.');
assert.equal((await response.json()).connections[0].label,'Saved church Page');
assert.equal(refreshCalls,1);assert.equal(apiCalls,1);assert.equal(renewals,1);
access=undefined;
response=await request();assert.equal(response.status,200,'A restarted worker must recover access from the signed-in page.');assert.equal(refreshCalls,1);
response=await request('POST');assert.equal(response.status,200);assert.equal(lastRequest.init.body.byteLength,13);assert.equal(apiCalls,3,'An authenticated POST must be sent exactly once.');
access={token:'old-access',expiresAt:1};account.save({access_token:'old-access',refresh_token:'private-page-refresh',expires_at:1});failRefresh=true;
const sent=apiCalls;response=await request();assert.equal(response.status,503,'A network failure requires retry, not another login.');assert.equal(apiCalls,sent);assert.equal(account.read().refresh_token,'private-page-refresh');
failRefresh=false;response=await request();assert.equal(response.status,200,'The same saved session must recover after the network returns.');
access={token:'old-access',expiresAt:1};openTab=false;response=await request();assert.equal(response.status,401,'Expired access without a signed-in page must not authorize API calls.');
openTab=true;clientUrl='https://untrusted.example.test/LIGHT/';response=await request();assert.equal(response.status,401,'An out-of-scope client must never provide access.');
console.log('Returning tabs, worker restart, persistent refresh recovery, private headers, and exactly-once request forwarding passed.');
