import {appTables} from './postgres-d1.mjs';
import {database,state,vault,saveVault,adminHeaders,context} from './runtime';
import {PrivateStorage} from './storage';
import {z} from 'zod';
const metadata=z.object({frozen:z.boolean(),tables:z.array(z.string()),runtime:z.record(z.string())});
const exportPage=z.object({table:z.string(),rows:z.array(z.record(z.union([z.string(),z.number(),z.null()]))),nextOffset:z.number().int().nonnegative().nullable()});
export async function migrationStep(){
 const sql=database(),current=await state();if(current.ready)throw new Error('The completed migration cannot be overwritten.');
 const settings=JSON.parse(await vault('ekklo-migration-source')||'null');if(!settings?.url||!settings?.gateToken||!settings?.exportKey)throw new Error('The migration source connection is not ready.');
 const source=new URL(settings.url);if(source.protocol!=='https:'||!source.hostname.endsWith('.chatgpt.site'))throw new Error('Invalid migration source.');
 async function sourceFetch(path:string,query:Record<string,string>={}){const url=new URL('/api/migration/'+path,source);for(const [key,value]of Object.entries(query))url.searchParams.set(key,value);const response=await fetch(url,{headers:{'OAI-Sites-Authorization':'Bearer '+settings.gateToken,'x-ekklo-migration-key':settings.exportKey},redirect:'error',signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error('The original workspace export is unavailable ('+response.status+').');return response;}
 let checkpoint=typeof current.checkpoint==='string'?JSON.parse(current.checkpoint):current.checkpoint||{};
 if(current.phase==='new'){
  const meta=metadata.parse(await (await sourceFetch('meta')).json());if(!meta.frozen)throw new Error('Pause the original workspace before copying its final records.');
  if(appTables.some(table=>!meta.tables.includes(table)))throw new Error('The original workspace schema is incomplete.');
  if(!meta.runtime?.TOKEN_ENCRYPTION_KEY)throw new Error('The original connection-encryption key is unavailable. Existing account connections were not changed.');
  await saveVault('ekklo-runtime',JSON.stringify(meta.runtime));
  await sql.unsafe("UPDATE ekklo_private.migration_state SET phase='tables',checkpoint=$1::text::jsonb,updated=now() WHERE id=true",[JSON.stringify({table:0,offset:0,counts:{}})]);
  return {phase:'tables',copiedTables:0};
 }
 if(current.phase==='tables'){
  const table=appTables[checkpoint.table];
  const page=exportPage.parse(await (await sourceFetch('table',{table,offset:String(checkpoint.offset)})).json());
  if(page.table!==table||!Array.isArray(page.rows))throw new Error('Invalid export page.');
  const allowed=new Set((await sql.unsafe('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',['ekklo_private',table])).map(r=>r.column_name));
  await sql.begin(async tx=>{
   for(const row of page.rows){
    // Pending provider authorizations remain at the original host; active social
    // connections are copied encrypted through their own tables.
    if(table==='oauth_states'||table==='runner_locks')continue;
    const columns=Object.keys(row);if(columns.some(c=>!allowed.has(c)||!/^[a-z_]+$/.test(c)))throw new Error('The destination does not support an exported column.');
    await tx.unsafe(`INSERT INTO ekklo_private.${table} (${columns.map(c=>'"'+c+'"').join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')}) ON CONFLICT DO NOTHING`,columns.map(c=>row[c]));
    if(table==='church_settings'){
     const email=JSON.parse(String(row.payload)).backgroundIdentityEmail;
     if(typeof email==='string'&&email.includes('@'))await tx.unsafe('INSERT INTO ekklo_private.legacy_accounts(owner,email) VALUES($1,$2) ON CONFLICT(owner) DO UPDATE SET email=excluded.email',[row.owner,email.trim().toLowerCase()]);
    }
    const keys=table==='assets'?[row.key]:table==='church_posts'?[row.image_key]:table==='church_templates'?[row.png_key,row.pixels_key]:[];
    for(const key of keys.filter(Boolean))await tx.unsafe('INSERT INTO ekklo_private.migration_objects(key) VALUES($1) ON CONFLICT DO NOTHING',[key]);
   }
   checkpoint={...checkpoint,counts:{...checkpoint.counts,[table]:(checkpoint.counts?.[table]||0)+page.rows.length},offset:page.nextOffset??0,table:page.nextOffset===null?checkpoint.table+1:checkpoint.table};
   await tx.unsafe('UPDATE ekklo_private.migration_state SET phase=$1,checkpoint=$2::text::jsonb,updated=now() WHERE id=true',[checkpoint.table>=appTables.length?'objects':'tables',JSON.stringify(checkpoint)]);
  });
  return {phase:checkpoint.table>=appTables.length?'objects':'tables',table,rows:page.rows.length,copiedTables:checkpoint.table};
 }
 if(current.phase==='objects'){
  const objects=await sql.unsafe('SELECT key FROM ekklo_private.migration_objects WHERE NOT copied ORDER BY key LIMIT 5');
  const bucket=new PrivateStorage(Deno.env.get('SUPABASE_URL')!,adminHeaders());await bucket.ensure();
  for(const object of objects){const response=await sourceFetch('object',{key:object.key});const bytes=await response.arrayBuffer();await bucket.put(object.key,bytes,{httpMetadata:{contentType:response.headers.get('content-type')||'application/octet-stream'}});await sql.unsafe('UPDATE ekklo_private.migration_objects SET copied=true,size=$2,error=NULL WHERE key=$1',[object.key,bytes.byteLength]);}
  const pending=Number((await sql.unsafe('SELECT count(*) AS n FROM ekklo_private.migration_objects WHERE NOT copied'))[0].n);
  if(!pending)await sql.unsafe("UPDATE ekklo_private.migration_state SET phase='verified',updated=now() WHERE id=true");
  return {phase:pending?'objects':'verified',copiedObjects:objects.length,pending};
 }
 if(current.phase==='verified')return {phase:'verified',counts:checkpoint.counts,objects:Number((await sql.unsafe('SELECT count(*) AS n FROM ekklo_private.migration_objects'))[0].n)};
 throw new Error('Unknown migration checkpoint.');
}
