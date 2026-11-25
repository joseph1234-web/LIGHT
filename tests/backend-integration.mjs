import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {readFile,readdir,mkdir} from 'node:fs/promises';
const pg=new PGlite();await pg.exec('CREATE ROLE anon;CREATE ROLE authenticated;');
for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile('supabase/migrations/'+file,'utf8'));
await pg.exec('CREATE SCHEMA vault; CREATE TABLE vault.decrypted_secrets(name text PRIMARY KEY,decrypted_secret text);');
const encryption=Buffer.alloc(32,9).toString('base64'),adminKey='a'.repeat(48),cronKey='c'.repeat(48);
await pg.query('INSERT INTO vault.decrypted_secrets VALUES($1,$2),($3,$4),($5,$6)',['ekklo-runtime',JSON.stringify({TOKEN_ENCRYPTION_KEY:encryption}), 'ekklo-migration-admin',adminKey,'ekklo-cron-secret',cronKey]);
async function unsafe(query,args=[]){const result=await pg.query(query,args);return Object.assign(result.rows,{count:result.affectedRows});}
const connection={unsafe,async begin(callback){await pg.exec('BEGIN');try{const result=await callback(connection);await pg.exec('COMMIT');return result;}catch(e){await pg.exec('ROLLBACK');throw e;}}};
let openedRequests=0,closedRequests=0;
globalThis.__ekkloTestDatabase=()=>{openedRequests++;let closed=false;return {...connection,async unsafe(...args){assert.equal(closed,false,'An ended request cannot reuse its database connection.');return unsafe(...args);},async end(){assert.equal(closed,false);closed=true;closedRequests++;}};};
const variables={SUPABASE_DB_URL:'postgres://test',SUPABASE_URL:'https://supabase.test',SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_fixture'})};
globalThis.Deno={env:{get:key=>variables[key]},serve(){}};
const users={alice:{id:'11111111-1111-4111-8111-111111111111',email:'alice@example.test',email_confirmed_at:'2026-01-01T00:00:00Z'},bob:{id:'22222222-2222-4222-8222-222222222222',email:'bob@example.test',email_confirmed_at:'2026-01-01T00:00:00Z'}};
let providerCalls=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
 const request=new Request(input,init),url=new URL(request.url);
 if(url.origin==='https://supabase.test'&&url.pathname==='/auth/v1/user'){
  const name=request.headers.get('Authorization')?.replace('Bearer ','');return Response.json(users[name]||{error:'unauthorized'},{status:users[name]?200:401});
 }
 providerCalls++;throw new Error('Unexpected external request: '+url.origin+url.pathname);
};
await mkdir('.sites-runtime/backend',{recursive:true});
await build({entryPoints:['backend/index.ts'],outfile:'.sites-runtime/backend/index.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'backend-fixtures',setup(b){b.onResolve({filter:/^postgres$/},()=>({path:'pg-fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default function(){return globalThis.__ekkloTestDatabase()}',loader:'js'}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:new URL('../backend/environment.ts',import.meta.url).pathname}));}}]});
const {handler}=await import('../.sites-runtime/backend/index.mjs');
const base='https://yznhkfyctmsmkeibepsh.supabase.co/functions/v1/ekklo-api',origin='https://joseph1234-web.github.io';
async function call(path,{user,body,headers={},method}={}){return handler(new Request(base+path,{method:method||(body===undefined?'GET':'POST'),headers:{Origin:origin,...(user?{Authorization:'Bearer '+user}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})}));}
assert.equal((await call('/health')).status,200);
assert.deepEqual((await Promise.all([call('/health'),call('/health')])).map(r=>r.status),[200,200]);
assert.equal(openedRequests,closedRequests,'Concurrent requests must each release their own connection.');
assert.equal((await handler(new Request('http://edge-runtime/ekklo-api/health'))).status,200,'The deployed Edge gateway mounts requests below the function name.');
assert.equal((await handler(new Request('http://edge-runtime/ekklo-apix/health'))).status,404,'A different function name must not match the API mount.');
assert.equal((await call('/api/state',{user:'alice'})).status,503);
assert.equal((await call('/migration/step',{method:'POST'})).status,404);
await pg.exec('UPDATE ekklo_private.migration_state SET ready=true;');
assert.equal((await call('/api/state')).status,401);
assert.equal((await call('/api/state',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'alice@example.test'}})).status,401);
assert.equal((await call('/api/settings',{user:'alice',body:{brand:'forged'},headers:{Origin:'https://evil.test'}})).status,403);
const preflight=await call('/api/state',{method:'OPTIONS',headers:{'Access-Control-Request-Headers':'authorization,content-type'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
await pg.query('INSERT INTO ekklo_private.legacy_accounts(owner,email) VALUES($1,$2)',['original-site-alice','alice@example.test']);
let response=await call('/api/state',{user:'alice'});assert.equal(response.status,200);let data=await response.json();assert.equal(data.account.email,'alice@example.test');assert.equal(data.setup.encryption,true);assert.ok(!JSON.stringify(data).includes(encryption));
assert.equal((await pg.query('SELECT owner FROM ekklo_private.identities WHERE email=$1',['alice@example.test'])).rows[0].owner,'original-site-alice');
response=await call('/api/settings',{user:'alice',body:{brand:'Alice church'}});assert.equal(response.status,200);
data=await (await call('/api/state',{user:'bob',headers:{'oai-authenticated-user-id':'original-site-alice'}})).json();assert.notEqual(data.settings.brand,'Alice church');assert.equal(data.account.email,'bob@example.test');
response=await call('/api/state',{user:'alice'});assert.equal((await response.json()).settings.brand,'Alice church');
assert.equal((await call('/api/media/nonexistent',{user:'bob'})).status,404);
response=await call('/api/oauth/facebook/start',{user:'alice',headers:{'X-Ekklo-Navigation':'1'}});data=await response.json();assert.equal(new URL(data.navigateTo).origin,origin);assert.equal(new URL(data.navigateTo).pathname,'/LIGHT/');
response=await call('/api/oauth/facebook/callback?state=made-up');assert.equal(response.status,302);assert.equal(new URL(response.headers.get('location')).origin,origin);
response=await call('/cron',{method:'POST',headers:{'x-ekklo-cron-secret':cronKey}});assert.equal((await response.json()).state,'paused');
assert.equal((await call('/cron',{method:'POST',headers:{'x-ekklo-cron-secret':'forged'}})).status,404);
assert.equal(providerCalls,0,'Authentication and setup checks must never send a social post.');
assert.equal(openedRequests,closedRequests,'Successes and rejected requests must release their connections.');
const privilege=await pg.query("SELECT has_schema_privilege('anon','ekklo_private','USAGE') AS anon,has_schema_privilege('authenticated','ekklo_private','USAGE') AS authenticated");assert.equal(privilege.rows[0].anon,false);assert.equal(privilege.rows[0].authenticated,false);
globalThis.fetch=originalFetch;await pg.close();console.log('Backend authentication, CORS, account migration, privacy, callback routing, and paused-scheduler checks passed.');
