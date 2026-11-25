import {rows,HttpError} from '../server';
import {churchConfig,saveChurchConfig,scheduleChurchPost} from './server';
import {dateInZone,addDays,isDate,isTime,makeChurchContent,type ChurchConfig} from './model';
import {churchScheduleBlock,churchHasSocialAttempt} from './scheduling';

export async function dailyScheduleOverview(owner:string,config:ChurchConfig,clock=new Date()){
 const today=dateInZone(clock,config.timezone),tomorrow=addDays(today,1);
 const records=await rows("SELECT * FROM church_posts WHERE owner=? AND series='daily' AND event_id='' AND local_date>=? AND local_date<=? ORDER BY created DESC",owner,today,tomorrow);
 return [today,tomorrow].map(date=>{
  const matching=records.filter(p=>p.local_date===date),active=matching.find(p=>p.status!=='removed'),removed=matching.filter(p=>p.status==='removed');
  const deliveryHeld=removed.some(churchHasSocialAttempt),block=active?churchScheduleBlock(active,true,clock.getTime()):deliveryHeld?'A Facebook upload already started for this date. Check the original delivery; it will not be sent again.':'';
  return {date,status:active?.status||(removed.length?'removed':'missing'),postId:active?.id,scheduled:active?.scheduled,canSchedule:!block,reason:block||(!config.dailyEnabled?'Daily Bible verse preparation is off.':removed.length?'The previous Canva render is in Removed history. A new schedule needs a verified PNG.':!active?'No daily verse schedule has been saved for this date.':''),canReplaceRemoved:!active&&removed.length>0&&!deliveryHeld,imageReady:!!active?.image_key,requiresManualImage:!active&&removed.length>0&&!deliveryHeld};
 });
}

export async function seriesScheduleOverview(owner:string,config:ChurchConfig,clock=new Date()){
 const today=dateInZone(clock,config.timezone),records=await rows("SELECT * FROM church_posts WHERE owner=? AND series IN ('christmas','service') AND local_date>=? AND local_date<=? ORDER BY created DESC",owner,today,addDays(today,6)),result=[];
 for(const series of ['christmas','service'] as const){
  const dates=Array.from({length:7},(_,i)=>addDays(today,i)).filter(date=>!!makeChurchContent(config,series,date));
  if(!dates.length)continue;
  const missing=dates.find(date=>!records.some(p=>p.series===series&&p.local_date===date&&p.status!=='removed')),date=missing||dates[0],matching=records.filter(p=>p.series===series&&p.local_date===date),active=matching.find(p=>p.status!=='removed'),removed=matching.filter(p=>p.status==='removed'),held=removed.some(churchHasSocialAttempt),block=active?churchScheduleBlock(active,true,clock.getTime()):held?'A Facebook upload already started for this date. Check the original delivery; it will not be sent again.':'';
  result.push({series,date,status:active?.status||(removed.length?'removed':'missing'),postId:active?.id,scheduled:active?.scheduled,time:series==='service'?config.saturdayTime:config.christmasTime,canSchedule:!block,canReplaceRemoved:!active&&removed.length>0&&!held,reason:block||(removed.length?'Previously removed. Create a new schedule explicitly; the original record stays in history.':!active?'No schedule has been saved for this date.':''),enabled:series==='service'?config.serviceEnabled:config.christmasEnabled,sundayDate:series==='service'?addDays(date,1):undefined});
 }
 return result;
}

/** Explicit, account-scoped scheduling; never runs a publisher or a Canva create. */
export async function scheduleDailyPosts(owner:string,input:any){
 if(!Array.isArray(input?.dates)||input.dates.length<1||input.dates.length>2||input.dates.some((d:any)=>typeof d!=='string'||!isDate(d))||new Set(input.dates).size!==input.dates.length||typeof input.time!=='string'||!isTime(input.time))throw new HttpError(400,'Choose one or two distinct dates and a time with hours and minutes.');
 let config=await churchConfig(owner);
 if(!config.dailyEnabled){if(input.enableSeries!==true)throw new HttpError(409,'Enable daily Bible verse preparation to save these schedules.');config=await saveChurchConfig(owner,{dailyEnabled:true});}
 if(input.useRecurringTime===true&&config.dailyTime!==input.time)config=await saveChurchConfig(owner,{dailyTime:input.time});
 const results:any[]=[];
 for(const date of input.dates){
  try{results.push({date,ok:true,...await scheduleChurchPost(owner,{series:'daily',date,time:input.time,restoreCancelled:input.restoreCancelled===true,replaceRemoved:input.replaceRemoved===true})});}
  catch(e){results.push({date,ok:false,error:e instanceof HttpError?e.message:'This schedule could not be saved. Refresh its current status before trying again.'});}
 }
 return {results,saved:results.filter(r=>r.ok).length,timezone:config.timezone,time:input.time};
}
