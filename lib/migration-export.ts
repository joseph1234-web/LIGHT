import {E,HttpError,json} from './server';
const tables=['activity','assets','canva_accounts','canva_page_rotations','canva_settings','church_posts','church_settings','church_templates','connections','drafts','jobs','oauth_states','preferences','provider_apps','runner_locks'];
const copiedKeys=['TOKEN_ENCRYPTION_KEY','META_APP_ID','META_APP_SECRET','META_GRAPH_VERSION','META_LOGIN_CONFIG_ID','INSTAGRAM_APP_ID','INSTAGRAM_APP_SECRET','INSTAGRAM_GRAPH_VERSION','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','CANVA_CLIENT_ID','CANVA_CLIENT_SECRET','YOUTUBE_API_KEY','CHRISTMAS_PACK_DEFAULT_EMAIL','CHURCH_AUTOMATION_OWNER_EMAIL'];
async function equal(a:string,b:string){const encode=new TextEncoder();const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',encode.encode(a)),crypto.subtle.digest('SHA-256',encode.encode(b))]);let difference=0;const aa=new Uint8Array(x),bb=new Uint8Array(y);for(let n=0;n<aa.length;n++)difference|=aa[n]^bb[n];return difference===0;}
/** One-time server-to-server export; never exposed to a browser or public file. */
export async function migrationExport(request:Request){
 const key=String(E().MIGRATION_SOURCE_TOKEN||'');
 if(key.length<40||!await equal(request.headers.get('x-ekklo-migration-key')||'',key))throw new HttpError(404,'This action was not found.');
 if(request.method!=='GET')throw new HttpError(405,'This export is read only.');
 const url=new URL(request.url),action=url.pathname.split('/').at(-1),database=E().DB as D1Database;
 if(action==='meta')return json({tables,frozen:E().MIGRATION_FREEZE==='1',runtime:Object.fromEntries(copiedKeys.filter(k=>typeof E()[k]==='string').map(k=>[k,E()[k]]))});
 if(action==='table'){
  const table=url.searchParams.get('table')||'',offset=Number(url.searchParams.get('offset')||0);
  if(!tables.includes(table)||!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw new HttpError(400,'Invalid export page.');
  const result=await database.prepare(`SELECT * FROM ${table} ORDER BY owner,rowid LIMIT 25 OFFSET ?`).bind(offset).all();
  return json({table,rows:result.results,nextOffset:result.results.length===25?offset+25:null});
 }
 if(action==='object'){
  const objectKey=url.searchParams.get('key')||'';
  if(!objectKey||objectKey.length>1500||objectKey.includes('..'))throw new HttpError(400,'Invalid object.');
  const owner=objectKey.split('/')[0];
  const exists=await database.prepare('SELECT owner FROM preferences WHERE owner=? UNION SELECT owner FROM church_settings WHERE owner=? LIMIT 1').bind(owner,owner).first();
  if(!exists)throw new HttpError(404,'Object not found.');
  const object=await E().BUCKET.get(objectKey);if(!object)throw new HttpError(404,'Object not found.');
  return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 throw new HttpError(404,'This action was not found.');
}
