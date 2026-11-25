import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {types as postgresTypes} from '../node_modules/postgres/src/types.js';
import {build} from 'esbuild';
import {mkdir,readFile,readdir} from 'node:fs/promises';
import {appTables} from '../backend/postgres-d1.mjs';

const pg=new PGlite();
await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile('supabase/migrations/'+file,'utf8'));
await pg.exec(`CREATE SCHEMA vault;
 CREATE TABLE vault.secrets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text UNIQUE,decrypted_secret text);
 CREATE VIEW vault.decrypted_secrets AS SELECT * FROM vault.secrets;
 CREATE FUNCTION vault.create_secret(value text,secret_name text) RETURNS uuid LANGUAGE sql AS $$ INSERT INTO vault.secrets(name,decrypted_secret) VALUES(secret_name,value) RETURNING id $$;
 CREATE FUNCTION vault.update_secret(secret_id uuid,value text) RETURNS void LANGUAGE sql AS $$ UPDATE vault.secrets SET decrypted_secret=value WHERE id=secret_id $$;`);
const admin='a'.repeat(48),source='https://migration-test.chatgpt.site';
await pg.query('INSERT INTO vault.secrets(name,decrypted_secret) VALUES($1,$2),($3,$4)',['ekklo-migration-admin',admin,'ekklo-migration-source',JSON.stringify({url:source,gateToken:'fixture-gate',exportKey:'fixture-export'})]);
async function unsafe(query,args=[]){
 // postgres.js uses the parameter type inferred by PostgreSQL. A direct jsonb
 // cast serializes even a pre-stringified argument again; a text cast does not.
 const bound=[...args];
 for(const match of query.matchAll(/\$(\d+)::jsonb\b/g))bound[Number(match[1])-1]=postgresTypes.json.serialize(args[Number(match[1])-1]);
 const result=await pg.query(query,bound);return Object.assign(result.rows,{count:result.affectedRows});
}
const connection={unsafe,async end(){},async begin(callback){await pg.exec('BEGIN');try{const result=await callback(connection);await pg.exec('COMMIT');return result;}catch(e){await pg.exec('ROLLBACK');throw e;}}};
globalThis.__ekkloMigrationDatabase=connection;
const variables={SUPABASE_DB_URL:'postgres://test',SUPABASE_URL:'https://supabase.test',SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_fixture'})};
globalThis.Deno={env:{get:key=>variables[key]},serve(){}};
const stamp='2026-11-25T00:00:00Z',owner='legacy-owner';
const exported={
 activity:[{id:'first',owner,message:'First',kind:'info',created:stamp},{id:'second',owner,message:'Second',kind:'info',created:stamp}],
 church_settings:[{owner,payload:JSON.stringify({backgroundIdentityEmail:'church@example.test'}),updated:stamp}],
 church_templates:[{id:'template',owner,name:'Saved',kind:'daily',png_key:owner+'/template.png',pixels_key:owner+'/template.bin',size:4,created:stamp,archived:0}],
 connections:[{id:'connection',owner,platform:'facebook',account_id:'page',label:'Church',secret:'encrypted-fixture',expires:null,created:stamp}],
 oauth_states:[{id:'pending',owner,provider:'facebook',created:stamp,verifier:'fixture'}],
 runner_locks:[{owner,token:'expired',expires:1}],
};
const uploaded=new Map(),visited=[];const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
 const request=new Request(input,init),url=new URL(request.url);
 if(url.origin===source){
  assert.equal(request.headers.get('OAI-Sites-Authorization'),'Bearer fixture-gate');
  assert.equal(request.headers.get('x-ekklo-migration-key'),'fixture-export');
  if(url.pathname.endsWith('/meta'))return Response.json({frozen:true,tables:appTables,runtime:{TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,9).toString('base64')}});
  if(url.pathname.endsWith('/table')){const table=url.searchParams.get('table'),offset=Number(url.searchParams.get('offset'));assert.ok(appTables.includes(table));visited.push(table);const records=exported[table]||[];return Response.json({table,rows:records.slice(offset,offset+1),nextOffset:offset+1<records.length?offset+1:null});}
  if(url.pathname.endsWith('/object'))return new Response(new Uint8Array([1,2,3,4]),{headers:{'Content-Type':'application/octet-stream'}});
 }
 if(url.origin==='https://supabase.test'){
  if(url.pathname==='/storage/v1/bucket')return Response.json([{id:'ekklo-private',public:false}]);
  if(url.pathname.startsWith('/storage/v1/object/ekklo-private/')&&request.method==='POST'){uploaded.set(decodeURIComponent(url.pathname.split('/ekklo-private/')[1]),new Uint8Array(await request.arrayBuffer()));return Response.json({saved:true});}
 }
 throw new Error('Unexpected external request.');
};
await mkdir('.sites-runtime/backend',{recursive:true});
await build({entryPoints:['backend/index.ts'],outfile:'.sites-runtime/backend/migration-test.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'migration-fixtures',setup(b){b.onResolve({filter:/^postgres$/},()=>({path:'pg-fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default function(){return globalThis.__ekkloMigrationDatabase}',loader:'js'}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:new URL('../backend/environment.ts',import.meta.url).pathname}));}}]});
const {handler}=await import('../.sites-runtime/backend/migration-test.mjs');
async function step(){const response=await handler(new Request('https://supabase.test/functions/v1/ekklo-api/migration/step',{method:'POST',headers:{'x-ekklo-migration-key':admin}}));assert.equal(response.status,200);return response.json();}
assert.equal((await step()).phase,'tables');
let checkpoint=(await pg.query('SELECT checkpoint FROM ekklo_private.migration_state')).rows[0].checkpoint;
assert.deepEqual(checkpoint,{table:0,offset:0,counts:{}},'New checkpoints must be JSON objects with the real postgres.js serializer.');
await pg.query('UPDATE ekklo_private.migration_state SET checkpoint=$1::jsonb',[JSON.stringify(JSON.stringify(checkpoint))]);
let result;
for(let count=0;count<30;count++){result=await step();if(result.phase==='verified')break;}
assert.equal(result.phase,'verified');
assert.equal((await pg.query('SELECT count(*)::int AS n FROM ekklo_private.activity')).rows[0].n,2);
assert.equal((await pg.query('SELECT email FROM ekklo_private.legacy_accounts')).rows[0].email,'church@example.test');
assert.equal((await pg.query('SELECT count(*)::int AS n FROM ekklo_private.oauth_states')).rows[0].n,0);
assert.equal((await pg.query('SELECT count(*)::int AS n FROM ekklo_private.runner_locks')).rows[0].n,0);
assert.deepEqual([...uploaded.keys()].sort(),[owner+'/template.bin',owner+'/template.png']);
assert.deepEqual([...new Set(visited)],appTables);
const state=(await pg.query('SELECT ready,cron_enabled,checkpoint FROM ekklo_private.migration_state')).rows[0];
assert.equal(state.ready,false);assert.equal(state.cron_enabled,false);assert.equal(typeof state.checkpoint,'object');
globalThis.fetch=originalFetch;await pg.close();
console.log('Migration initialization, legacy checkpoint recovery, pagination, account mapping, private files, and paused cutover checks passed.');
