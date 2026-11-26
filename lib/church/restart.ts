import {applyCountdownImage} from './countdown-images';
import {db,E,one,rows,run,now,uid,HttpError,setup} from '../server';
import {churchConfig} from './server';
import {churchHasSocialAttempt} from './scheduling';
import {addDays,dateInZone,makeChurchContent,suggestedPostingTime,zonedTime,type ChurchSpec,type ChurchContent} from './model';

function uncertainCanva(payload:string){
 const c=JSON.parse(payload).canva;if(!c||c.state==='ready')return false;
 if(c.state==='pending'&&!c.claimToken&&!c.autofillJobId&&!c.designId&&!c.exportJobId&&!c.phase&&!c.pageReservation)return false;
 if(c.method==='direct_api'){
  if(c.phase==='autofill_pending'||c.phase==='create_started')return !c.autofillJobId;
  if(c.phase==='design_ready')return !c.designId;
  if(['export_pending','export_started','awaiting_verification'].includes(c.phase))return !c.designId||!c.exportJobId;
 }
 return !(c.designId&&c.exportJobId);
}
/** An explicit new cycle. Prior renders are retired, never retried or reassigned. */
export async function restartChurchSchedule(owner:string,input:any,clock=new Date()){
 if(typeof input?.requestId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(input.requestId))throw new HttpError(400,'Use one stable request ID for this scheduling reset.');
 const token=uid(),stamp=Date.now(),locked=await one('INSERT INTO runner_locks (owner,token,expires) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE runner_locks.expires<? RETURNING owner',owner,token,stamp+120000,stamp);
 if(!locked)throw new HttpError(409,'A queue check is running. Retry this same reset request after it finishes.');
 try{
  const config:any=await churchConfig(owner),receiptPath='$.scheduleRestartReceipts."'+input.requestId+'"',receipt=config.scheduleRestartReceipts?.[input.requestId]||(config.lastScheduleRestart?.requestId===input.requestId?config.lastScheduleRestart.result:null);
  if(receipt){if(!config.scheduleRestartReceipts?.[input.requestId])await run('UPDATE church_settings SET payload=json_set(payload,?,json(?)) WHERE owner=?',receiptPath,JSON.stringify(receipt),owner);return {...receipt,alreadyCompleted:true};}
  const today=dateInZone(clock,config.timezone),last=addDays(today,6),all=await rows("SELECT * FROM church_posts WHERE owner=? AND status NOT IN ('published','removed') ORDER BY scheduled",owner),history=await rows('SELECT * FROM church_posts WHERE owner=? AND local_date>=? AND local_date<=?',owner,today,last);
  const canvaRow=await one('SELECT payload FROM canva_settings WHERE owner=?',owner),canva=canvaRow?JSON.parse(canvaRow.payload):null;
  if(canva)for(const [series,binding] of Object.entries(canva.bindings||{}) as [string,any][])if(binding.sourceUrl===config.canvaSources[series]){binding.page=1;binding.pageMode='rotate';}
  const page=await one("SELECT account_id FROM connections WHERE owner=? AND platform='facebook'",owner),facebookReady=(await setup(owner)).facebook;
  const prepared:{id:string;series:string;date:string;scheduled:string;status:string;usesCanva:boolean}[]=[],skipped:{series:string;date:string;reason:string}[]=[],inserts=[];
  for(let offset=0;offset<7;offset++){
   const date=addDays(today,offset),choices:{kind:ChurchSpec['kind'];eventId:string}[]=[];
   if(config.dailyEnabled)choices.push({kind:'daily',eventId:''});if(config.serviceEnabled)choices.push({kind:'service',eventId:''});if(config.christmasEnabled)choices.push({kind:'christmas',eventId:''});for(const event of config.events)if(event.enabled)choices.push({kind:'event',eventId:event.id});
   for(const {kind,eventId} of choices){
    const content=makeChurchContent(config,kind,date,eventId) as ChurchContent|null;if(!content)continue;
    const prior=history.filter(p=>p.series===kind&&p.event_id===eventId&&p.local_date===date);
    if(prior.some(churchHasSocialAttempt)){skipped.push({series:kind,date,reason:'An earlier delivery already started; this date will not be sent again.'});continue;}
    if(prior.some(p=>uncertainCanva(p.payload))){skipped.push({series:kind,date,reason:'An earlier Canva request has no confirmed result ID; it stays held without replay.'});continue;}
    const savedTime=kind==='daily'?config.dailyTime:kind==='service'?config.saturdayTime:kind==='christmas'?config.christmasTime:config.events.find((e:any)=>e.id===eventId)!.postTime;
    const currentChoice=prior.find(p=>p.status!=='removed'&&Date.parse(p.scheduled)>clock.getTime()&&JSON.parse(p.payload).customSchedule?.time);
    let time=date===today&&currentChoice?JSON.parse(currentChoice.payload).customSchedule.time:suggestedPostingTime(date,savedTime,config.timezone,clock);
    const scheduled=zonedTime(date,time,config.timezone);if(Date.parse(scheduled)<=clock.getTime()){skipped.push({series:kind,date,reason:'No future posting time remains on this date.'});continue;}
    content.scheduled=scheduled;if(time!==savedTime)content.customSchedule={time};
    await applyCountdownImage(owner,content);
    if(config.canvaSources[kind]&&!content.countdownImage&&content.spec.occasion!=='newyear')content.canva={sourceUrl:config.canvaSources[kind],renderId:uid(),state:'pending'};
    (content as any).scheduleReset={requestId:input.requestId,started:today};
    const status=content.christmasImage&&!content.christmasImage.available?'needs_review':!config.autoPublish?'draft':!page||!facebookReady?'waiting_connection':page.account_id!==config.autoPageId?'needs_review':'scheduled';
    const message=content.christmasImage&&!content.christmasImage.available?content.christmasImage.reason:status==='draft'?'Automatic church publishing is off.':status==='waiting_connection'?'Waiting for the saved Facebook Page.':status==='needs_review'?'The connected Facebook Page does not match the saved destination.':'New scheduling cycle. Canva pages restart at 1.';
    const id=uid(),created=now();inserts.push(db().prepare('INSERT INTO church_posts (id,owner,series,event_id,local_date,scheduled,payload,status,page_id,message,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,owner,kind,eventId,date,scheduled,JSON.stringify(content),status,config.autoPageId||null,message,created,created));
    prepared.push({id,series:kind,date,scheduled,status,usesCanva:!!content.canva});
   }
  }
  const batchId=uid(),created=now(),result={startDate:today,timezone:config.timezone,removed:all.length,created:prepared.length,rotationStartsAt:1,schedules:prepared.map(({id,...p})=>p),skipped};
  await E().BUCKET.put(`${owner}/church-queue-clears/${batchId}.json`,new TextEncoder().encode(JSON.stringify({owner,batchId,created,posts:all,previousCanvaSettings:canvaRow?.payload||null,previousRotations:await rows('SELECT * FROM canva_page_rotations WHERE owner=?',owner)})),{httpMetadata:{contentType:'application/json'}});
  const statements=all.map(p=>db().prepare("UPDATE church_posts SET payload=json_set(payload,'$.queueRemoval',json_object('batchId',?,'removedAt',?,'previousStatus',status)),status='removed',message='Replaced by an explicitly requested scheduling cycle. Prior provider IDs are retained and will not be retried.',updated=? WHERE owner=? AND id=? AND payload=? AND updated=? AND status=?").bind(batchId,created,created,owner,p.id,p.payload,p.updated,p.status));
  statements.push(db().prepare('UPDATE canva_page_rotations SET next_page=1,updated=? WHERE owner=?').bind(created,owner),...inserts);
  if(canva)statements.push(db().prepare('UPDATE canva_settings SET payload=?,updated=? WHERE owner=? AND payload=?').bind(JSON.stringify(canva),created,owner,canvaRow.payload));
  statements.push(db().prepare("UPDATE church_settings SET payload=json_set(payload,'$.manualQueue',json('false'),'$.lastQueueClear',json(?),'$.lastScheduleRestart',json(?),?,json(?)),updated=? WHERE owner=?").bind(JSON.stringify({batchId,count:all.length,created,scope:'reset'}),JSON.stringify({requestId:input.requestId,result,created}),receiptPath,JSON.stringify(result),created,owner));
  await db().batch(statements);return result;
 }finally{await run('DELETE FROM runner_locks WHERE owner=? AND token=?',owner,token);}
}
