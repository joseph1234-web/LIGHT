import {GET,POST} from '../app/api/[...path]/route';
import {withEnvironment} from './environment';
import {database,context,state,verifiedUser,accountOwner,secretMatches} from './runtime';
import {migrationStep} from './migrate';
import {runChurchBackground} from '../lib/church/automation-worker';
import {runQueue} from '../lib/publisher';
import {POST as mcpRequest} from '../app/mcp/route';

const prefix='/functions/v1/ekklo-api';
function output(data:any,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
function cleanHeaders(headers:Headers){const result=new Headers(headers);for(const key of [...result.keys()])if(key.toLowerCase().startsWith('oai-')||['cookie','host','authorization','apikey'].includes(key.toLowerCase()))result.delete(key);return result;}
export async function handler(request:Request):Promise<Response>{
 let response:Response;let settings:any;
 const url=new URL(request.url);
 const mount=[prefix,'/ekklo-api'].find(value=>url.pathname===value||url.pathname.startsWith(value+'/'));
 const path=mount?url.pathname.slice(mount.length):url.pathname;
 try{
  settings=await state();const origin=request.headers.get('origin'),allowedOrigin=new URL(settings.app_url).origin;
  if(origin&&origin!==allowedOrigin)return output({error:'Open this action from ekklo..'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':request.headers.get('access-control-request-headers')||'authorization,apikey,content-type,range','Access-Control-Max-Age':'600',Vary:'Origin'}});
  if(path==='/health')response=output({service:'ekklo',ready:settings.ready,phase:settings.phase,cronEnabled:settings.cron_enabled});
  else if(path==='/mcp'){
   if(request.method!=='POST'||!settings.ready||!await secretMatches(request.headers.get('x-ekklo-bridge-secret')||'','ekklo-bridge-secret'))response=output({error:'Not found.'},404);
   else{
    const original=request.headers.get('x-ekklo-owner')||'',email=(request.headers.get('x-ekklo-email')||'').trim().toLowerCase();
    if(!original||original.length>300||email.length>320||!email.includes('@'))response=output({error:'This connection could not be verified.'},403);
    else{
     const identities=await database().unsafe<{owner:string}[]>('SELECT owner FROM ekklo_private.identities WHERE email=$1 UNION ALL SELECT owner FROM ekklo_private.legacy_accounts WHERE email=$1 LIMIT 1',[email]);
     const identity=new Request(url,{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':identities[0]?.owner||original,'oai-authenticated-user-email':email},body:await request.arrayBuffer()});
     response=await withEnvironment(await context(),()=>mcpRequest(identity));
    }
   }
  }else if(path==='/migration/step'){
   if(request.method!=='POST'||!await secretMatches(request.headers.get('x-ekklo-migration-key')||'','ekklo-migration-admin'))response=output({error:'Not found.'},404);
   else response=output(await migrationStep());
  }else if(path==='/cron'){
   if(request.method!=='POST'||!await secretMatches(request.headers.get('x-ekklo-cron-secret')||'','ekklo-cron-secret'))response=output({error:'Not found.'},404);
   else if(!settings.ready||!settings.cron_enabled)response=output({state:'paused',published:0});
   else{
    const environment=await context();
    response=await withEnvironment(environment,async()=>{
     const owners=await database().unsafe('SELECT owner,payload FROM ekklo_private.church_settings ORDER BY owner');const outcomes=[];
     const started=Date.now();
     for(const row of owners){if(Date.now()-started>70000)break;const email=JSON.parse(row.payload).backgroundIdentityEmail;if(!email)continue;const identity=new Request(url,{headers:{'oai-authenticated-user-id':'supabase-scheduler','oai-authenticated-user-email':environment.CHURCH_AUTOMATION_OWNER_EMAIL||''}});try{outcomes.push(await runChurchBackground(identity,{expectedAccountEmail:email,publishVerified:true}));}catch{outcomes.push({state:'error'});}}
     const mediaOwners=await database().unsafe("SELECT DISTINCT owner FROM ekklo_private.jobs WHERE status IN ('queued','uploading','processing') UNION SELECT owner FROM ekklo_private.preferences WHERE payload::jsonb->>'autopilot'='true'");
     for(const row of mediaOwners){if(Date.now()-started>95000)break;try{await runQueue(row.owner);}catch{outcomes.push({state:'media_check_error'});}}
     return output({state:'checked',accounts:outcomes.length});
    });
   }
  }else if(path.startsWith('/api/')){
   if(!settings.ready)response=output({error:'Your workspace is being moved. Saved content is protected while preparation finishes.'},503);
   else{
    const environment=await context(),headers=cleanHeaders(request.headers);let owner:string|undefined,email='';
    const callback=/^\/api\/(?:oauth\/(facebook|instagram|youtube)|canva)\/callback$/.exec(path);
    if(callback&&request.method==='GET'){
     const stateToken=url.searchParams.get('state')||'',provider=callback[1]||'canva';
     const pending=await database().unsafe('SELECT owner FROM ekklo_private.oauth_states WHERE id=$1 AND provider=$2 AND created>$3',[stateToken,provider,new Date(Date.now()-600000).toISOString()]);owner=pending[0]?.owner;
     if(!owner)return Response.redirect(settings.app_url+'?view=connections&connectionNotice=expired',302);
     email=(await database().unsafe<{email:string}[]>('SELECT email FROM ekklo_private.identities WHERE owner=$1',[owner]))[0]?.email||'';
    }else if(path==='/api/canva/return'&&request.method==='GET'&&!request.headers.get('authorization')){
     const target=new URL(settings.app_url);target.searchParams.set('canva_return',url.searchParams.get('correlation_jwt')||'');return Response.redirect(target.toString(),302);
    }else{
     const user=await verifiedUser(request);if(!user)return cors(output({error:'Sign in to ekklo. again to continue.'},401),settings.app_url);
     owner=await accountOwner(user);email=user.email;
    }
    headers.set('oai-authenticated-user-id',owner!);headers.set('oai-authenticated-user-email',email);
    const internalUrl=new URL(url);internalUrl.pathname=path;
    const internal=new Request(internalUrl,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer()});
    response=await withEnvironment(environment,()=>request.method==='GET'?GET(internal):POST(internal));
    if(response.status>=300&&response.status<400&&response.headers.has('location')){
     let location=response.headers.get('location')!;const destination=new URL(location,url);
     if(destination.origin===url.origin&&!destination.pathname.startsWith(prefix)){const target=new URL(settings.app_url);target.search=destination.search;target.hash=destination.hash;location=target.toString();}
     if(request.headers.get('x-ekklo-navigation')==='1')response=output({navigateTo:location});else response=Response.redirect(location,302);
    }
   }
  }else response=output({error:'Not found.'},404);
 }catch(error){console.error('ekklo backend request failed',error instanceof Error?error.name:'Error');response=output({error:'The request could not be completed. Please try again.'},500);}
 return settings?cors(response,settings.app_url):response;
}
function cors(response:Response,appUrl:string){const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin',new URL(appUrl).origin);headers.set('Access-Control-Expose-Headers','Content-Type,Content-Length,Content-Range,Content-Disposition,Accept-Ranges');headers.set('Vary','Origin');headers.set('X-Content-Type-Options','nosniff');return new Response(response.body,{status:response.status,statusText:response.statusText,headers});}
Deno.serve(handler);
