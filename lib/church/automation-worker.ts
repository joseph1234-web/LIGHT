import {E,one,run,now,uid,HttpError,user} from '../server';
import {churchConfig,processChurchPosts,prepareChurchPosts} from './server';
import {runAutomaticCanva} from './canva-automation';
import {christmasPack} from './christmas-pack';
import {restartChurchSchedule} from './restart';

/** Only trusted Sites identity can bind a visitor to unattended processing. */
export async function adoptChristmasPack(owner:string){
 const config:any=await churchConfig(owner);await run("UPDATE church_settings SET payload=json_set(payload,'$.christmasImageSource','uploaded_pack','$.christmasPackAdopted',?,'$.christmasLegacyCanvaSource',?,'$.canvaSources.christmas',''),updated=? WHERE owner=?",christmasPack.id,config.canvaSources.christmas||config.christmasLegacyCanvaSource||'',now(),owner);return churchConfig(owner);
}

export async function bindChurchIdentity(owner:string,verifiedEmail:string){
 const email=verifiedEmail.trim().toLowerCase();if(!email||!email.includes('@'))return;
 const config:any=await churchConfig(owner),adopt=String(E().CHRISTMAS_PACK_DEFAULT_EMAIL||'').toLowerCase()===email&&config.christmasPackAdopted!==christmasPack.id;
 if(config.backgroundIdentityEmail===email&&!adopt)return;
 if(adopt)await run("UPDATE church_settings SET payload=json_set(payload,'$.backgroundIdentityEmail',?,'$.christmasImageSource','uploaded_pack','$.christmasPackAdopted',?,'$.christmasLegacyCanvaSource',?,'$.canvaSources.christmas',''),updated=? WHERE owner=?",email,christmasPack.id,config.canvaSources.christmas||config.christmasLegacyCanvaSource||'',now(),owner);
 else await run("UPDATE church_settings SET payload=json_set(payload,'$.backgroundIdentityEmail',?),updated=? WHERE owner=?",email,now(),owner);
}

/** Page and cloud checks can publish ready images only when explicitly requested. */
export async function advanceChurchAutomation(owner:string,{source='page',publishVerified=false,postIds}:{source?:'page'|'cloud'|'schedule';publishVerified?:boolean;postIds?:string[]}={}){
 const token=uid(),stamp=Date.now();
 const locked=await one('INSERT INTO runner_locks (owner,token,expires) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE runner_locks.expires<? RETURNING owner',owner,token,stamp+120000,stamp);
 if(!locked)return {state:'busy',advanced:0};
 try{
  // Uploaded images and the built-in renderer need a rolling queue too. Canva
  // being paused must not prevent these independent series from being prepared.
  if(source!=='schedule')await prepareChurchPosts(owner);
  const images=await runAutomaticCanva(owner,source==='cloud'?4:2,{postIds,prepare:source!=='schedule'});
  const church=publishVerified?await processChurchPosts(owner):null;
  const checkedAt=now();await run("UPDATE church_settings SET payload=json_set(payload,'$.lastImageCheck',json(?)),updated=? WHERE owner=?",JSON.stringify({checkedAt,source,advanced:images.advanced,published:church?.published||0,state:images.state}),checkedAt,owner);
  return {state:images.state,advanced:images.advanced,checkedAt,published:church?.published||0,results:images.results||[],outcomes:(images.results||[]).reduce((counts:Record<string,number>,item:any)=>({...counts,[item.state]:(counts[item.state]||0)+1}),{})};
 }finally{await run('DELETE FROM runner_locks WHERE owner=? AND token=?',owner,token);}
}

/** Saving is durable even if image preparation cannot finish in the same request. */
export async function prepareScheduledCanva(owner:string,postIds:string[]):Promise<{state:string;advanced:number;results?:{postId:string;state:string}[]}>{
 if(!postIds.length)return {state:'idle',advanced:0};
 try{return await advanceChurchAutomation(owner,{source:'schedule',postIds});}
 catch{return {state:'pending',advanced:0};}
}

/** A site-owned wake-up, not visitor impersonation or an arbitrary owner-ID API. */
async function enrolledChurchAccount(request:Request,input:any){
 user(request);
 const caller=(request.headers.get('oai-authenticated-user-email')||'').toLowerCase(),operator=String(E().CHURCH_AUTOMATION_OWNER_EMAIL||'').toLowerCase();
 if(!operator||caller!==operator)throw new HttpError(403,'Only the configured Site automation operator can run this background check.');
 const email=typeof input?.expectedAccountEmail==='string'?input.expectedAccountEmail.trim().toLowerCase():'';
 if(!email||!email.includes('@'))throw new HttpError(400,'Specify the exact intended church account email.');
 const target=await one("SELECT owner FROM church_settings WHERE json_extract(payload,'$.backgroundIdentityEmail')=? ORDER BY updated DESC LIMIT 1",email);
 return {email,owner:target?.owner};
}
export async function restartChurchBackground(request:Request,input:any){
 const target=await enrolledChurchAccount(request,input);if(!target.owner)throw new HttpError(409,'Open the intended church account in the Site before resetting its schedule.');
 return {accountEmail:target.email,...await restartChurchSchedule(target.owner,{requestId:input.requestId})};
}
export async function runChurchBackground(request:Request,input:any){
 const target=await enrolledChurchAccount(request,input),email=target.email;
 if(!target.owner)return {accountEmail:email,state:'waiting_for_account_visit',advanced:0,published:0};
 // Native Site administration can queue an expiring, idempotent reset for an exact enrolled account.
 // The same verified operator is still required; visitor bodies cannot supply this directive.
 let scheduleRestart:any;const queued=String(E().CHURCH_SCHEDULE_RESET_REQUEST||'');
 if(queued&&queued.length<=1200){let directive:any;try{directive=JSON.parse(queued)}catch{}
  if(directive?.action==='restart_from_today'&&directive.expectedAccountEmail===email&&Date.parse(directive.expiresAt)>Date.now())scheduleRestart=await restartChurchSchedule(target.owner,{requestId:directive.requestId});
 }
 // An explicit Site-admin request can resume rolling preparation once. Unlike
 // resetting a schedule, this preserves every cancelled post and Canva receipt.
 const preparationRequest=String(E().CHURCH_PREPARATION_REQUEST||'');
 if(preparationRequest&&preparationRequest.length<=1200){let directive:any;try{directive=JSON.parse(preparationRequest)}catch{}
  if(directive?.action==='resume_preparation'&&directive.expectedAccountEmail===email&&typeof directive.requestId==='string'&&directive.requestId.length>0&&directive.requestId.length<=120&&Date.parse(directive.expiresAt)>Date.now()){
   await run("UPDATE church_settings SET payload=json_set(payload,'$.manualQueue',json('false'),'$.lastPreparationRequest',json(?)),updated=? WHERE owner=? AND json_extract(payload,'$.lastPreparationRequest.requestId') IS NOT ?",JSON.stringify({requestId:directive.requestId,appliedAt:now()}),now(),target.owner,directive.requestId);
  }
 }
 const receipt=async(state:string,advanced=0,published=0)=>{const checkedAt=now();await run("UPDATE church_settings SET payload=json_set(payload,'$.lastCloudRun',json(?)),updated=? WHERE owner=?",JSON.stringify({checkedAt,state,advanced,published}),checkedAt,target.owner);return checkedAt;};
 try{
  const config=await churchConfig(target.owner),canva=await one('SELECT payload FROM canva_settings WHERE owner=?',target.owner);
  if(!config.autoPublish&&!JSON.parse(canva?.payload||'{}').enabled){const checkedAt=await receipt('paused');return {accountEmail:email,state:'paused',advanced:0,published:0,checkedAt,...(scheduleRestart?{scheduleRestart}:{})};}
  const result=await advanceChurchAutomation(target.owner,{source:'cloud',publishVerified:input.publishVerified===true});
  const checkedAt=await receipt(result.state,result.advanced,result.published||0);
  // The operator receives outcomes, never another visitor's drafts, claims or credentials.
  return {accountEmail:email,state:result.state,automaticPreparation:!config.manualQueue,autoPublish:config.autoPublish,advanced:result.advanced,published:result.published||0,ready:(result.results||[]).filter((r:any)=>r.state==='ready').length,outcomes:result.outcomes||{},checkedAt,awaitingReview:(result.results||[]).filter((r:any)=>r.state==='needs_review'||r.state==='pending_review').length,...(scheduleRestart?{scheduleRestart}:{})};
 }catch(error){await receipt('error');throw error;}
}
