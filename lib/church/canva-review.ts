import {E,one,rows,run,uid,now,HttpError} from '../server';
import {churchConfig} from './server';
import {canvaAccess,canvaApi} from './canva-automation';
import {downloadCanvaPng} from './canva';
import type {ChurchSpec} from './model';

const mutable=['draft','scheduled','waiting_connection','paused'];
const cutoff=()=>new Date(Date.now()-75*60000).toISOString();
const active=(config:any,row:any)=>row.series==='daily'?config.dailyEnabled:row.series==='service'?config.serviceEnabled:row.series==='christmas'?config.christmasEnabled:config.events.some((e:any)=>e.id===row.event_id&&e.enabled);
function editable(row:any){
 if(!row||!mutable.includes(row.status)||!row.image_key||row.claimed||row.remote_id||row.scheduled<cutoff())return false;
 const c=JSON.parse(row.payload).canva;
 return !!c&&c.state==='ready'&&c.method==='direct_api'&&!!c.designId&&!!c.sourceDesignId&&c.designId!==c.sourceDesignId&&Number.isInteger(c.page)&&c.page>0;
}
function confirmedMeta(meta:any,c:any){
 if(meta?.id!==c.designId||!Number.isInteger(meta.updated_at)||meta.updated_at<1||!Number.isInteger(meta.page_count)||c.page>meta.page_count)throw new HttpError(409,'Canva could not confirm this generated design and its selected page. The saved PNG is unchanged.');
 return meta;
}
function editLink(value:unknown,state:string){
 let url:URL;try{url=new URL(String(value));}catch{throw new HttpError(502,'Canva did not return an editing link for this post.');}
 if(url.protocol!=='https:'||url.username||url.password||!['www.canva.com','canva.com'].includes(url.hostname))throw new HttpError(502,'Canva did not return a valid editing link.');
 url.searchParams.set('correlation_state',state);return url.toString();
}
/** Change only the edit subrecord, conditionally. Never remove the ready PNG. */
async function patch(owner:string,row:any,edit:any){
 const r=await run("UPDATE church_posts SET payload=json_set(payload,'$.canva.edit',json(?)),updated=? WHERE owner=? AND id=? AND payload=? AND image_key=? AND claimed IS NULL AND remote_id IS NULL AND scheduled>=? AND status IN ('draft','scheduled','waiting_connection','paused')",JSON.stringify(edit),now(),owner,row.id,row.payload,row.image_key,cutoff());
 return !!r.meta.changes;
}
async function originalRevision(token:string,c:any){
 if(Number.isInteger(c.outputUpdated)&&c.outputUpdated>0)return c.outputUpdated;
 if(!c.autofillJobId)throw new HttpError(409,'The original output revision is not confirmed. Keep the existing PNG and review this Canva job.');
 const job=(await canvaApi(token,'/autofills/'+encodeURIComponent(c.autofillJobId))).job;
 if(job?.id!==c.autofillJobId||job.status!=='success'||job.result?.type!=='create_design'||job.result.design?.id!==c.designId||!Number.isInteger(job.result.design.updated_at))throw new HttpError(409,'The original Canva output could not be confirmed. The saved PNG is unchanged.');
 return job.result.design.updated_at;
}
/** Fresh provider link to the output copy, scoped to the authenticated studio. */
export async function reviewCanvaPost(owner:string,input:any,origin:string){
 const row=await one('SELECT * FROM church_posts WHERE owner=? AND id=?',owner,input.postId);
 if(!editable(row))throw new HttpError(409,'This post is not available for Canva editing. Started and completed deliveries stay unchanged.');
 const c=JSON.parse(row.payload).canva,config=await churchConfig(owner);
 if(c.renderId!==input.renderId||config.canvaSources[row.series as ChurchSpec['kind']]!==c.sourceUrl||!active(config,row))throw new HttpError(409,'This post or its saved template changed. Refresh Prepared posts.');
 const access=await canvaAccess(owner);if(access.accountId!==c.canvaAccountId)throw new HttpError(409,'Reconnect the Canva account that created this post.');
 const meta=confirmedMeta((await canvaApi(access.token,'/designs/'+encodeURIComponent(c.designId))).design,c);
 const knownUpdated=c.edit?.syncedRevision??await originalRevision(access.token,c),stamp=now();
 const edit={...c.edit,correlationState:uid(),returnExpiresAt:new Date(Date.now()+86400000).toISOString(),openedAt:stamp,knownUpdated,exports:c.edit?.exports||[],nextCheckAt:stamp};
 if(meta.updated_at!==knownUpdated&&edit.observedRevision!==meta.updated_at){edit.observedRevision=meta.updated_at;edit.observedAt=stamp;}
 const editUrl=editLink(meta.urls?.edit_url,edit.correlationState);
 if(!await patch(owner,row,edit))throw new HttpError(409,'This post changed while its Canva link was opening. Refresh the current post.');
 return {editUrl,page:c.page,returnUrl:new URL('/api/canva/return',origin).toString(),reviewOptional:true};
}

/** Retain late confirmed export IDs even if the post was removed in flight. */
async function checkpointExport(owner:string,row:any,index:number,attempt:any,jobId:string){
 const c=JSON.parse(row.payload).canva,path=`$.canva.edit.exports[${index}]`;
 const r=await run(`UPDATE church_posts SET payload=json_set(payload,? ,?,?,'export_pending'),updated=? WHERE owner=? AND id=? AND json_extract(payload,'$.canva.renderId')=? AND json_extract(payload,'$.canva.designId')=? AND json_extract(payload,?)=? AND (json_extract(payload,?) IS NULL OR json_extract(payload,?)=?)`,path+'.jobId',jobId,path+'.phase',now(),owner,row.id,c.renderId,c.designId,path+'.id',attempt.id,path+'.jobId',path+'.jobId',jobId);
 return !!r.meta.changes;
}
async function syncOne(owner:string,row:any,access:{token:string;accountId:string}){
 const content=JSON.parse(row.payload),c=content.canva,edit=c.edit,stamp=now();
 if(access.accountId!==c.canvaAccountId){await patch(owner,row,{...edit,lastCheckedAt:stamp,nextCheckAt:new Date(Date.now()+60000).toISOString(),error:'Reconnect the Canva account that created this post. The last ready image remains scheduled.'});return 'edit_account_changed';}
 const index=edit.exports.length-1,attempt=edit.exports[index];
 if(attempt?.phase==='export_started'&&!attempt.jobId||attempt?.phase==='needs_review'){await patch(owner,row,{...edit,lastCheckedAt:stamp,nextCheckAt:new Date(Date.now()+3600000).toISOString(),error:edit.error||'This edit export needs review and will not be repeated. The last ready image remains scheduled.'});return 'edit_needs_review';}
 const meta=confirmedMeta((await canvaApi(access.token,'/designs/'+encodeURIComponent(c.designId))).design,c);
 const checked={...edit,lastCheckedAt:stamp,nextCheckAt:new Date(Date.now()+15000).toISOString(),error:''};
 if(attempt?.phase==='export_pending'){
  if(!attempt.jobId)return 'edit_needs_review';
  const job=(await canvaApi(access.token,'/exports/'+encodeURIComponent(attempt.jobId))).job;
  if(job?.id!==attempt.jobId)throw new HttpError(502,'Canva did not confirm the saved edit export.');
  if(job.status==='failed'){checked.exports=[...edit.exports];checked.exports[index]={...attempt,phase:'needs_review'};checked.error='Canva could not export this edit. The last ready image remains scheduled.';await patch(owner,row,checked);return 'edit_needs_review';}
  if(job.status!=='success'){await patch(owner,row,checked);return 'edit_exporting';}
  if(!Array.isArray(job.urls)||job.urls.length!==1)throw new HttpError(502,'Canva must return exactly one PNG page for this saved edit export.');
  if(meta.updated_at!==attempt.revision){checked.exports=[...edit.exports];checked.exports[index]={...attempt,phase:'superseded'};checked.observedRevision=meta.updated_at;checked.observedAt=stamp;await patch(owner,row,checked);return 'edit_waiting';}
  const png=await downloadCanvaPng(job.urls[0]);
  const after=confirmedMeta((await canvaApi(access.token,'/designs/'+encodeURIComponent(c.designId))).design,c);
  if(after.updated_at!==attempt.revision){checked.exports=[...edit.exports];checked.exports[index]={...attempt,phase:'superseded'};checked.observedRevision=after.updated_at;checked.observedAt=stamp;await patch(owner,row,checked);return 'edit_waiting';}
  const config=await churchConfig(owner),settings=await one('SELECT payload FROM canva_settings WHERE owner=?',owner);
  if(!JSON.parse(settings?.payload||'{}').enabled||!active(config,row)||config.canvaSources[row.series as ChurchSpec['kind']]!==c.sourceUrl)return 'paused';
  checked.exports=[...edit.exports];checked.exports[index]={...attempt,phase:'ready',exportedAt:stamp,previousImageKey:row.image_key};checked.syncedRevision=attempt.revision;checked.knownUpdated=attempt.revision;checked.syncedAt=stamp;
  const key=`${owner}/church/canva-edit-${row.id}-${attempt.id}.png`;
  await E().BUCKET.put(key,png,{httpMetadata:{contentType:'image/png'}});
  const saved=await run("UPDATE church_posts SET image_key=?,payload=json_set(payload,'$.canva.edit',json(?),'$.canva.outputUpdated',?,'$.canva.verifiedBy','canva_edit_sync','$.canva.verifiedAt',?),updated=? WHERE owner=? AND id=? AND payload=? AND image_key=? AND claimed IS NULL AND remote_id IS NULL AND scheduled>=? AND status IN ('draft','scheduled','waiting_connection','paused')",key,JSON.stringify(checked),attempt.revision,stamp,stamp,owner,row.id,row.payload,row.image_key,cutoff());
  if(!saved.meta.changes){await E().BUCKET.delete(key);return 'changed';}
  return 'edit_synced';
 }
 if(meta.updated_at===(edit.syncedRevision??edit.knownUpdated)){checked.observedRevision=null;checked.observedAt=null;await patch(owner,row,checked);return 'edit_unchanged';}
 if(edit.observedRevision!==meta.updated_at||!edit.observedAt){checked.observedRevision=meta.updated_at;checked.observedAt=stamp;await patch(owner,row,checked);return 'edit_waiting';}
 // Wait for a stable saved revision; never export a design still being saved.
 if(Date.parse(edit.observedAt)>Date.now()-15000||meta.updated_at*1000>Date.now()-15000){await patch(owner,row,checked);return 'edit_waiting';}
 const freshAttempt={id:uid(),revision:meta.updated_at,phase:'export_started',startedAt:stamp};
 checked.exports=[...edit.exports,freshAttempt];
 if(!await patch(owner,row,checked))return 'changed';
 // This is a new export of a confirmed edit, never a retry of an unknown request.
 const result=await canvaApi(access.token,'/exports',{design_id:c.designId,format:{type:'png',pages:[c.page],lossless:true,transparent_background:false}});
 if(typeof result.job?.id!=='string'||!result.job.id||result.job.id.length>160)throw new HttpError(502,'Canva did not confirm an edit export job ID. This export will not be repeated. The saved image remains scheduled.');
 if(!await checkpointExport(owner,row,checked.exports.length-1,freshAttempt,result.job.id))return 'changed';
 return 'edit_exporting';
}
export async function syncCanvaEdits(owner:string,access:{token:string;accountId:string},limit=2,postIds?:string[]){
 const settings=await one('SELECT payload FROM canva_settings WHERE owner=?',owner);if(!JSON.parse(settings?.payload||'{}').enabled)return [];
 const config=await churchConfig(owner),ids=postIds?.slice(0,2);
 if(ids&&!ids.length)return [];
 const list=await rows("SELECT * FROM church_posts WHERE owner=? AND image_key IS NOT NULL AND claimed IS NULL AND remote_id IS NULL AND scheduled>=? AND status IN ('draft','scheduled','waiting_connection','paused') AND json_extract(payload,'$.canva.state')='ready' AND json_extract(payload,'$.canva.edit.openedAt') IS NOT NULL AND (json_extract(payload,'$.canva.edit.nextCheckAt') IS NULL OR json_extract(payload,'$.canva.edit.nextCheckAt')<=?)"+(ids?' AND id IN ('+ids.map(()=>'?').join(',')+')':'')+" ORDER BY COALESCE(json_extract(payload,'$.canva.edit.lastCheckedAt'),'') ASC, scheduled ASC LIMIT 100",owner,cutoff(),now(),...(ids||[]));
 const results=[];
 for(const row of list){const c=JSON.parse(row.payload).canva;if(!editable(row)||!active(config,row)||config.canvaSources[row.series as ChurchSpec['kind']]!==c.sourceUrl)continue;
  try{results.push({postId:row.id,state:await syncOne(owner,row,access)});}catch(e){
   const fresh=await one('SELECT * FROM church_posts WHERE owner=? AND id=?',owner,row.id);
   if(editable(fresh)){const edit=JSON.parse(fresh.payload).canva.edit;await patch(owner,fresh,{...edit,lastCheckedAt:now(),nextCheckAt:new Date(Date.now()+45000).toISOString(),error:e instanceof HttpError?e.message:'Canva edit sync could not finish. The last ready image remains scheduled.'});}
   results.push({postId:row.id,state:'edit_sync_pending'});
  }
  if(results.length>=Math.min(4,Math.max(1,limit)))break;
 }
 return results;
}

function decode(value:string){if(!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('Invalid JWT encoding');return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
/** Canva return callbacks are notifications; only verified, owner-bound state is accepted. */
export async function returnFromCanva(owner:string,jwt:string){
 if(!jwt||jwt.length>12000)throw new HttpError(400,'This Canva return link is invalid. Open your post in ekklo. to check its saved image.');
 let payload:any;
 try{
  const parts=jwt.split('.');if(parts.length!==3)throw new Error();const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));payload=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if(header.alg!=='EdDSA'||typeof header.kid!=='string')throw new Error();
  const response=await fetch('https://api.canva.com/rest/v1/connect/keys',{redirect:'manual',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error();const keys:any=await response.json(),jwk=keys.keys?.find((k:any)=>k.kid===header.kid&&k.kty==='OKP'&&k.crv==='Ed25519'&&(!k.alg||k.alg==='EdDSA'));
  if(!jwk)throw new Error();const key=await crypto.subtle.importKey('jwk',jwk,{name:'Ed25519'},false,['verify']);
  if(!await crypto.subtle.verify('Ed25519',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw new Error();
  const app=await one("SELECT secret FROM provider_apps WHERE owner=? AND provider='canva'",owner);
  const {unseal}=await import('../server'),credentials=app?await unseal(app.secret):{clientId:E().CANVA_CLIENT_ID};
  const account=await one('SELECT account_id FROM canva_accounts WHERE owner=?',owner);
  if(payload.aud!==credentials.clientId||payload.type!=='rti'||typeof payload.exp!=='number'||payload.exp*1000<=Date.now()||payload.exp*1000>Date.now()+2*86400000||typeof payload.jti!=='string'||account?.account_id!==payload.team_id+':'+payload.sub||typeof payload.correlation_state!=='string'||payload.correlation_state.length>50)throw new Error();
 }catch{throw new HttpError(400,'Canva’s return could not be verified. Open Prepared posts to check the saved image.');}
 const row=await one("SELECT * FROM church_posts WHERE owner=? AND json_extract(payload,'$.canva.designId')=? AND json_extract(payload,'$.canva.edit.correlationState')=?",owner,payload.design_id,payload.correlation_state);
 if(!row||!editable(row))throw new HttpError(409,'This post changed or its delivery already started. Its saved image is unchanged.');
 const edit=JSON.parse(row.payload).canva.edit;
 if(Date.parse(edit.returnExpiresAt)<Date.now())throw new HttpError(400,'This Canva return link expired. Open Review post again.');
 if(edit.returnJti&&edit.returnJti!==payload.jti)throw new HttpError(409,'Open the current Canva editing link from Review post.');
 if(!edit.returnJti&&!await patch(owner,row,{...edit,returnJti:payload.jti,returnedAt:now(),nextCheckAt:now()}))throw new HttpError(409,'This post changed while returning from Canva.');
 return {postId:row.id};
}
