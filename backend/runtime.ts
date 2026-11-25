import postgres from 'postgres';
import {createD1Adapter} from './postgres-d1.mjs';
import {PrivateStorage} from './storage';
let connection:ReturnType<typeof postgres>|undefined;
export function database(){
 if(connection)return connection;
 const url=Deno.env.get('SUPABASE_DB_URL');if(!url)throw new Error('The backend database connection is not configured.');
 return connection=postgres(url,{prepare:false,max:2,idle_timeout:20,connect_timeout:15,types:{bigint:{to:20,from:[20],serialize:(value:any)=>String(value),parse:(value:string)=>Number(value)}}});
}
export function adminHeaders(){
 let keys:Record<string,string>={};try{keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');}catch{}
 const key=keys.default||Object.values(keys)[0]||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!key)throw new Error('The backend service connection is not configured.');
 return {apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{})};
}
export async function vault(name:string){const result=await database().unsafe('SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=$1',[name]);return result[0]?.decrypted_secret as string|undefined;}
export async function saveVault(name:string,value:string){const sql=database();const existing=await sql.unsafe('SELECT id FROM vault.secrets WHERE name=$1',[name]);if(existing.length)await sql.unsafe('SELECT vault.update_secret($1::uuid,$2::text)',[existing[0].id,value]);else await sql.unsafe('SELECT vault.create_secret($1::text,$2::text)',[value,name]);}
export async function state(){return (await database().unsafe('SELECT * FROM ekklo_private.migration_state WHERE id=true'))[0];}
export async function context(){
 const sql=database(),settings=await state();
 const runtime=JSON.parse(await vault('ekklo-runtime')||'{}');
 const exec=async(connection:any,{sql,values}:{sql:string;values:any[]})=>{const result=await connection.unsafe(sql,values);return {rows:[...result],affectedRows:result.count};};
 const DB=createD1Adapter((statement:any)=>exec(sql,statement),(callback:any)=>sql.begin((tx:any)=>callback((statement:any)=>exec(tx,statement))));
 const url=Deno.env.get('SUPABASE_URL')!;
 const BUCKET=new PrivateStorage(url,adminHeaders());
 return {...runtime,DB,BUCKET,PUBLIC_APP_URL:settings.app_url,PUBLIC_API_BASE:settings.api_base,ASSETS:{fetch(request:Request){const path=new URL(request.url).pathname;return fetch(new URL(path.replace(/^\//,''),settings.app_url),{redirect:'error'});}}};
}
export type VerifiedUser={id:string;email:string;email_confirmed_at?:string|null};
export async function verifiedUser(request:Request):Promise<VerifiedUser|null>{
 const authorization=request.headers.get('authorization')||'';if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization))return null;
 const url=Deno.env.get('SUPABASE_URL')!;
 const response=await fetch(url+'/auth/v1/user',{headers:{...adminHeaders(),Authorization:authorization},redirect:'error'});
 if(!response.ok)return null;const raw:unknown=await response.json();if(!raw||typeof raw!=='object')return null;const user=raw as Record<string,unknown>;if(typeof user.id!=='string'||!/^[a-f0-9-]{36}$/i.test(user.id)||typeof user.email!=='string')return null;return {id:user.id,email:user.email,email_confirmed_at:typeof user.email_confirmed_at==='string'?user.email_confirmed_at:null};
}
export async function accountOwner(user:any){
 const sql=database(),existing=await sql.unsafe('SELECT owner FROM ekklo_private.identities WHERE auth_user_id=$1::uuid',[user.id]);if(existing.length)return existing[0].owner as string;
 const email=user.email.trim().toLowerCase();
 const legacy=await sql.unsafe('SELECT owner FROM ekklo_private.legacy_accounts WHERE email=$1',[email]);
 if(legacy.length&&!user.email_confirmed_at)throw new Error('Confirm your email before bringing over your existing church workspace.');
 const owner=legacy[0]?.owner||'supabase:'+user.id;
 await sql.unsafe('INSERT INTO ekklo_private.identities(auth_user_id,owner,email) VALUES($1::uuid,$2,$3) ON CONFLICT(auth_user_id) DO NOTHING',[user.id,owner,email]);
 return (await sql.unsafe('SELECT owner FROM ekklo_private.identities WHERE auth_user_id=$1::uuid',[user.id]))[0].owner as string;
}
export async function secretMatches(value:string,name:string){const expected=await vault(name);if(!expected||expected.length<40)return false;const e=new TextEncoder(),[aa,bb]=await Promise.all([crypto.subtle.digest('SHA-256',e.encode(value)),crypto.subtle.digest('SHA-256',e.encode(expected))]);const a=new Uint8Array(aa),b=new Uint8Array(bb);let diff=0;for(let n=0;n<a.length;n++)diff|=a[n]^b[n];return diff===0;}
