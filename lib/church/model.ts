import {christmasPackImage} from './christmas-pack';
import {countdownSeason} from './countdown';
import {morningVerse,morningCaption,monthlyTheme,DAILY_INSPIRATION_VERSION} from './monthly-inspiration';
import {isCanvaLink,defaultCanvaSources} from './canva-links';
import {verses,getVerse,christmasVerses,bibleVersions,bibleVersionInfo,type BibleVersion,type ChurchVerse} from './verses';
export type TemplateUse={id:string;x:number;y:number;width:number;height:number;font:'sans'|'serif'|'bold';fontSize:number;textColor:string;panelColor:string;panelOpacity:number;showHeading:boolean;showBrand:boolean};
export const defaultTemplateUse:TemplateUse={id:'',x:10,y:25,width:80,height:60,font:'serif',fontSize:52,textColor:'#ffffff',panelColor:'#142c27',panelOpacity:0.35,showHeading:true,showBrand:true};
export type ChurchEvent={id:string;name:string;date:string;postTime:string;countdownDays:number;verseId:string;message:string;enabled:boolean};
export type ChurchConfig={churchName:string;location:string;serviceTime:string;serviceMessage:string;timezone:string;bibleVersion:BibleVersion;dailyEnabled:boolean;dailyTime:string;serviceEnabled:boolean;saturdayTime:string;serviceVerseId:string;christmasEnabled:boolean;christmasTime:string;christmasStartDays:number;theme:'auto'|'dawn'|'midnight'|'evergreen';autoPublish:boolean;autoPageId:string;manualQueue?:boolean;christmasImageSource:'canva'|'uploaded_pack';events:ChurchEvent[];templates:Partial<Record<ChurchSpec['kind'],TemplateUse>>;canvaSources:Partial<Record<ChurchSpec['kind'],string>>};
export type ChurchSpec={kind:'daily'|'service'|'christmas'|'event';title:string;heading:string;verse:ChurchVerse;brand:string;details:string[];theme:string;countdown:number|null;dateLabel:string;message?:string;imageTextVersion?:number;template?:TemplateUse;occasion?:'christmas'|'newyear'};
export const CHURCH_IMAGE_TEXT_VERSION=3;
export function currentImageText(content:{series:string;spec:ChurchSpec}){return content.series==='event'||content.spec.imageTextVersion===CHURCH_IMAGE_TEXT_VERSION;}
export function imageTextMetadata(spec:ChurchSpec){
 const daily=spec.kind==='daily',christmas=spec.kind==='christmas';
 return {heading:daily||spec.kind==='service'?'':spec.heading,brand:daily||christmas?'':spec.brand,dateLabel:daily||christmas?'':spec.dateLabel,translation:spec.kind==='event'?bibleVersionInfo(spec.verse.translation).name:'',translationCode:spec.kind==='event'?bibleVersionInfo(spec.verse.translation).short:'',countdownText:christmas&&spec.countdown!==null?`${spec.countdown===1?'day':'days'} until ${spec.occasion==='newyear'?'New Year':'Christmas'}`:''};
}
export type ChurchContent={series:string;eventId:string;date:string;title:string;caption:string;scheduled:string;spec:ChurchSpec;countdownImage?:{id:string;key:string;date:string;occasion:'christmas'|'newyear';revision:string};christmasImage?:ReturnType<typeof christmasPackImage>;retiredCanva?:Record<string,any>;dailyInspiration?:{version:number;month:string;theme:string};customSchedule?:{time:string};canva?:{sourceUrl:string;renderId:string;state:'pending'|'rendering'|'ready';claimToken?:string;designId?:string;exportJobId?:string;method?:string;phase?:string;autofillJobId?:string;exportUrl?:string;exportedAt?:string;page?:number;pageMode?:'single'|'rotate';pageCount?:number;pageReservation?:string;sourceDesignId?:string;textFields?:string;canvaAccountId?:string;lastCheckedAt?:string;providerStatus?:string;inputHash?:string;verifiedInputHash?:string;automaticVerification?:string;verifiedBy?:string;verifiedAt?:string;outputUpdated?:number;edit?:{openedAt:string;[key:string]:any};requiresManualReview?:boolean;priorPostId?:string;error?:string}};
export const churchDefaults:ChurchConfig={churchName:'LIGHT HOUSE A.G',location:'Maliwanag, Mansalay, Oriental Mindoro',serviceTime:'08:30',serviceMessage:'Come as you are. Bring your family and worship with us.',timezone:'Asia/Manila',bibleVersion:'web',dailyEnabled:true,dailyTime:'07:00',serviceEnabled:false,saturdayTime:'18:00',serviceVerseId:'ps100-2',christmasEnabled:true,christmasTime:'09:00',christmasStartDays:24,theme:'auto',autoPublish:false,autoPageId:'',christmasImageSource:'canva',events:[],templates:{},canvaSources:{...defaultCanvaSources}};
export const isDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export const isTime=(s:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function dayOrdinal(date:string){return Math.floor(new Date(date+'T00:00:00Z').getTime()/86400000)}
export function addDays(date:string,amount:number){return new Date((dayOrdinal(date)+amount)*86400000).toISOString().slice(0,10)}
export function dateInZone(date:Date,timezone:string){const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const f=(k:string)=>p.find(p=>p.type===k)!.value;return `${f('year')}-${f('month')}-${f('day')}`;}
export function zonedTime(date:string,time:string,timezone:string){
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number);const desired=Date.UTC(y,m-1,d,h,min);let target=desired;
 for(let n=0;n<4;n++){const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(target));const f=(k:string)=>Number(p.find(p=>p.type===k)!.value);const actual=Date.UTC(f('year'),f('month')-1,f('day'),f('hour'),f('minute'));const delta=desired-actual;if(!delta)break;target+=delta;}
 return new Date(target).toISOString();
}
export function dateLabel(date:string){return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(date+'T00:00:00Z'))}
/** Compact dates for small Canva fields; captions keep their full date. */
export function imageDateLabel(date:string){if(!isDate(date))return '';const [year,month,day]=date.split('-').map(Number);return `${['Jan.','Feb.','Mar.','Apr.','May','Jun.','Jul.','Aug.','Sept.','Oct.','Nov.','Dec.'][month-1]} ${day}, ${year}`;}
export function timeLabel(time:string){const [h,m]=time.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;}
export function suggestedPostingTime(date:string,time:string,timezone:string,clock=new Date()){
 if(date!==dateInZone(clock,timezone)||Date.parse(zonedTime(date,time,timezone))>clock.getTime())return time;
 const later=new Date(clock.getTime()+3600000);if(dateInZone(later,timezone)!==date)return time;
 return new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(later);
}
export function validateChurchConfig(input:any,previous:ChurchConfig):ChurchConfig{
 const c={...previous};for(const k of ['churchName','location','serviceMessage'] as const)if(typeof input[k]==='string')c[k]=input[k].trim().slice(0,k==='serviceMessage'?500:k==='location'?160:80);
 for(const k of ['dailyEnabled','serviceEnabled','christmasEnabled','autoPublish'] as const)if(typeof input[k]==='boolean')c[k]=input[k];
 for(const k of ['dailyTime','saturdayTime','christmasTime'] as const)if(typeof input[k]==='string'){if(!isTime(input[k]))throw new Error('Choose a valid posting time with hours and minutes.');c[k]=input[k];}
 if(typeof input.serviceTime==='string'){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.serviceTime))throw new Error('Choose a valid Sunday service time.');c.serviceTime=input.serviceTime;}
 if(typeof input.timezone==='string'){new Intl.DateTimeFormat('en',{timeZone:input.timezone}).format(new Date());c.timezone=input.timezone;}
 if(input.bibleVersion!==undefined){if(!bibleVersions.some(v=>v.id===input.bibleVersion))throw new Error('Choose an available Bible version.');c.bibleVersion=input.bibleVersion;}
 if(typeof input.serviceVerseId==='string'){if(!verses.some(v=>v.id===input.serviceVerseId))throw new Error('Choose a verse from the included public-domain collection.');c.serviceVerseId=input.serviceVerseId;}
 if(['auto','dawn','midnight','evergreen'].includes(input.theme))c.theme=input.theme;
 if(typeof input.christmasStartDays==='number')c.christmasStartDays=Math.min(100,Math.max(0,Math.round(input.christmasStartDays)));
 if(input.events!==undefined){if(!Array.isArray(input.events)||input.events.length>12)throw new Error('Add up to 12 special events.');const ids=new Set<string>();c.events=input.events.map((e:any)=>{
 if(typeof e.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(e.id)||ids.has(e.id))throw new Error('Each event needs a unique ID.');ids.add(e.id);
 if(typeof e.name!=='string'||!e.name.trim()||e.name.length>80)throw new Error('Give each event a name of up to 80 characters.');if(!isDate(e.date))throw new Error('Choose a valid event date.');
 if(!isTime(e.postTime))throw new Error('Choose a valid event posting time with hours and minutes.');if(!verses.some(v=>v.id===e.verseId))throw new Error('Choose an included Bible verse for the event.');
 return {id:e.id,name:e.name.trim(),date:e.date,postTime:e.postTime,countdownDays:Math.min(100,Math.max(0,Math.round(Number(e.countdownDays)||0))),verseId:e.verseId,message:typeof e.message==='string'?e.message.slice(0,1500):'',enabled:e.enabled===true};});}
 if(input.templates!==undefined){if(!input.templates||typeof input.templates!=='object')throw new Error('Choose valid image templates.');c.templates={};for(const k of ['daily','service','christmas','event'] as const){const t=input.templates[k];if(!t?.id)continue;if(typeof t.id!=='string'||t.id.length>80)throw new Error('Choose an uploaded template.');const n=(key:string,min:number,max:number,fallback:number)=>Math.min(max,Math.max(min,Number.isFinite(Number(t[key]))?Number(t[key]):fallback));const x=n('x',0,75,10),y=n('y',0,75,25);c.templates[k]={id:t.id,x,y,width:n('width',20,100-x,80),height:n('height',20,100-y,60),font:['sans','serif','bold'].includes(t.font)?t.font:'serif',fontSize:n('fontSize',24,90,52),textColor:/^#[0-9a-fA-F]{6}$/.test(t.textColor)?t.textColor:'#ffffff',panelColor:/^#[0-9a-fA-F]{6}$/.test(t.panelColor)?t.panelColor:'#142c27',panelOpacity:n('panelOpacity',0,0.9,0.35),showHeading:t.showHeading!==false,showBrand:t.showBrand!==false};}}
 if(input.canvaSources!==undefined){if(!input.canvaSources||typeof input.canvaSources!=='object'||Array.isArray(input.canvaSources))throw new Error('Choose valid Canva template links.');c.canvaSources={};for(const k of ['daily','service','christmas','event'] as const){const value=input.canvaSources[k];if(!value)continue;if(!isCanvaLink(value))throw new Error('Use an HTTPS Canva design or shared-template link.');c.canvaSources[k]=value;}}
 if(input.christmasImageSource==='canva'||input.christmasImageSource==='uploaded_pack')c.christmasImageSource=input.christmasImageSource;
 if(c.christmasImageSource==='uploaded_pack')c.canvaSources={...c.canvaSources,christmas:''};
 if(c.serviceEnabled&&(!c.churchName||!c.location))throw new Error('Add the church name and service location before enabling Saturday announcements.');
 return c;
}
export function makeChurchContent(c:ChurchConfig,kind:ChurchSpec['kind'],date:string,eventId='',sample=false):ChurchContent|null{
 if(!isDate(date))throw new Error('Choose a valid date.');
 let verse=getVerse(verses[((dayOrdinal(date)%34)+34)%34].id,c.bibleVersion),title='',heading='',details:string[]=[],caption='',time=c.dailyTime,countdown:number|null=null;
 const sunday=addDays(date,1);const brand=c.churchName||'A MOMENT IN THE WORD';
 if(kind==='daily'){verse=morningVerse(date,c.bibleVersion);title='Bible verse of the day';heading='A moment in the Word.';caption=morningCaption(c.churchName,date,verse);}
 if(kind==='service'){
 if(!sample&&new Date(date+'T00:00:00Z').getUTCDay()!==6)return null;
 if(!sample&&(!c.churchName||!c.location))return null;
 const nextSunday=sample?addDays(date,(7-new Date(date+'T00:00:00Z').getUTCDay())%7||7):sunday;
 verse=getVerse(c.serviceVerseId,c.bibleVersion);title='Sunday service announcement';heading='Sunday service';time=c.saturdayTime;
 details=[dateLabel(nextSunday),timeLabel(c.serviceTime),c.location||'Add your church location'];
 caption=`YOU’RE INVITED TO SUNDAY SERVICE\n\n${c.churchName||'[Church name]'}\n${details[0]} · ${details[1]}\n${c.location||'[Service location]'}\n\n${c.serviceMessage}\n\n${verse.text}\n— ${verse.reference}\n\n#SundayService #WorshipWithUs #ChurchFamily`;
 }
 if(kind==='christmas'){
 const season=countdownSeason(date);countdown=season.daysRemaining;if(countdown<0||(!sample&&season.occasion==='christmas'&&countdown>c.christmasStartDays))return null;
 if(season.occasion==='newyear'){verse=getVerse(['1th5-18','rom12-12','php4-13','ps100-5'][countdown%4],c.bibleVersion);time=c.christmasTime;title=countdown===0?'New Year’s Day':`${countdown} ${countdown===1?'day':'days'} until New Year`;heading=countdown===0?'Happy New Year':'New Year';caption=`${countdown===0?'HAPPY NEW YEAR!':`${countdown} ${countdown===1?'DAY':'DAYS'} UNTIL NEW YEAR`}\n\nA new year of faith, hope, and gratitude.\n\n${verse.text}\n— ${verse.reference}\n\n${c.churchName?c.churchName+'\n':''}#NewYear #Faith #Hope`;}else{
 verse=getVerse(christmasVerses[countdown%christmasVerses.length],c.bibleVersion);time=c.christmasTime;title=countdown===0?'Christmas Day':`${countdown} ${countdown===1?'day':'days'} until Christmas`;heading=countdown===0?'Merry Christmas':'Christmas';
 caption=`${countdown===0?'MERRY CHRISTMAS!':`${countdown} ${countdown===1?'DAY':'DAYS'} UNTIL CHRISTMAS`}\n\n${countdown===0?'Celebrating the birth of Jesus Christ.':'Counting down with hope, joy, and the promise of Christ.'}\n\n${verse.text}\n— ${verse.reference}\n\n${c.churchName?c.churchName+'\n':''}#ChristmasCountdown #JesusIsTheReason #HopeAndJoy`;
 }
 }
 if(kind==='event'){
 const event=c.events.find(e=>e.id===eventId);if(!event)return null;countdown=dayOrdinal(event.date)-dayOrdinal(date);if(countdown<0||(!sample&&countdown>event.countdownDays))return null;
 verse=getVerse(event.verseId,c.bibleVersion);time=event.postTime;heading=event.name;title=countdown===0?`${event.name} is today`:`${countdown} ${countdown===1?'day':'days'} until ${event.name}`;
 details=[dateLabel(event.date)];caption=`${countdown===0?'TODAY: ':`${countdown} ${countdown===1?'DAY':'DAYS'} TO GO — `}${event.name}\n${details[0]}\n\n${event.message}\n\n${verse.text}\n— ${verse.reference}\n\n${c.churchName?c.churchName+'\n':''}#ChurchEvents #Faith #ChurchFamily`;
 }
 return {series:kind,eventId,date,title,caption,...(kind==='daily'?{dailyInspiration:{version:DAILY_INSPIRATION_VERSION,month:monthlyTheme(date).month,theme:monthlyTheme(date).title}}:{}),...(kind==='christmas'&&countdownSeason(date).occasion==='christmas'&&c.christmasImageSource==='uploaded_pack'?{christmasImage:christmasPackImage(date)}:{}),scheduled:zonedTime(date,time,c.timezone),spec:{kind,...(kind==='christmas'?{occasion:countdownSeason(date).occasion}:{}),title,heading,verse,brand,details,theme:c.theme==='auto'?(kind==='daily'?'dawn':kind==='service'?'midnight':'evergreen'):c.theme,countdown,dateLabel:dateLabel(date),...(kind!=='event'?{imageTextVersion:CHURCH_IMAGE_TEXT_VERSION}:{}),...(kind==='service'?{message:c.serviceMessage}:{}),...(c.templates?.[kind]?.id?{template:c.templates[kind]}:{})}};
}
