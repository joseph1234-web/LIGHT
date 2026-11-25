import {imageTextMetadata,imageDateLabel,addDays,type ChurchConfig,type ChurchContent,type ChurchSpec} from './model';

export const canvaFieldHelp:Record<string,string>={
 heading:'Post heading',verse:'Exact Bible verse',reference:'Bible reference',translation:'Selected Bible translation',
 date:'Date of the post (same as postDate)',postDate:'Date of the post',churchName:'Church name',sundayDate:'Following Sunday date',serviceTime:'Sunday service time',
 location:'Church location',serviceMessage:'Invitation message',daysRemaining:'Countdown number only',countdownText:'Christmas wording without the number; special events retain the full countdown',
 eventDate:'Special-event date',eventMessage:'Special-event message',
 verseBlock:'Bible verse and reference only; special events retain their Bible version',
 verseCardText:'Bible verse and reference only; special events retain their heading and date',
};
export const canvaFieldAlternatives:Record<string,string[]>={
 verseBlock:['verse','reference','verseCardText'],
 verseCardText:['verse','reference','verseBlock'],
 date:['postDate'],postDate:['date'],
};
export const requiredCanvaFields:Record<ChurchSpec['kind'],string[]>={
 daily:['verseCardText'],
 service:['sundayDate','serviceTime','location','churchName','serviceMessage'],
 christmas:['daysRemaining','verseBlock'],
 event:['heading','verse','reference','translation','postDate','churchName','countdownText','eventDate','eventMessage'],
};
export const optionalCanvaFields:Record<ChurchSpec['kind'],string[]>={daily:[],service:['date','verseBlock'],christmas:['heading','countdownText'],event:[]};
export function canvaValues(content:ChurchContent,config:ChurchConfig):Record<string,string>{
 const s=content.spec,event=config.events.find(e=>e.id===content.eventId);
 const image=imageTextMetadata(s),special=content.series==='event',verseBlock=s.verse.text+'\n\n'+s.verse.reference+(special?' ('+image.translation+')':'');
 const imageDate=image.dateLabel?imageDateLabel(content.date):'';
 return {heading:image.heading,verse:s.verse.text,reference:s.verse.reference,translation:image.translation,date:imageDate,postDate:imageDate,churchName:image.brand,
 sundayDate:content.series==='service'?imageDateLabel(addDays(content.date,1)):'',serviceTime:content.series==='service'?s.details[1]||'':'',location:config.location,
 serviceMessage:content.series==='service'?s.message??config.serviceMessage:'',daysRemaining:s.countdown===null?'':String(s.countdown),
 countdownText:content.series==='christmas'?image.countdownText:s.countdown===null?'':s.countdown===0?'Today':`${s.countdown} ${s.countdown===1?'day':'days'} to go`,
 eventDate:content.series==='event'&&event?imageDateLabel(event.date):'',eventMessage:content.series==='event'?event?.message||'':'',
 verseBlock,verseCardText:special?s.heading+'\n\n'+verseBlock+'\n\n'+imageDate:verseBlock,};
}
export function checkCanvaFields(series:ChurchSpec['kind'],dataset:Record<string,{type:string}>){
 const covered=new Set(Object.entries(dataset).filter(([,v])=>v.type==='text').flatMap(([k])=>[k,...(canvaFieldAlternatives[k]||[]),...(series==='event'?(k==='verseBlock'?['translation']:k==='verseCardText'?['heading','translation','postDate']:k==='daysRemaining'?['countdownText']:[]):[])]));
 if(covered.has('verse')&&covered.has('reference')){covered.add('verseBlock');covered.add('verseCardText');}
 const missing=requiredCanvaFields[series].filter(k=>!covered.has(k));
 const unknown=Object.entries(dataset).filter(([k,v])=>v.type==='text'&&!Object.hasOwn(canvaFieldHelp,k)).map(([k])=>k);
 return {missing,unknown,ready:missing.length===0&&unknown.length===0};
}
/** The review uses the fields captured for the render, or the current template's fields. */
export function canvaImageText(content:ChurchContent,config:ChurchConfig,labels?:string[]){
 const values=canvaValues(content,config),selected=labels??requiredCanvaFields[content.spec.kind];
 return selected.filter(k=>Object.hasOwn(canvaFieldHelp,k)).map(k=>values[k]).filter((v):v is string=>typeof v==='string'&&v.trim().length>0);
}
