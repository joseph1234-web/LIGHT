import {E,one,rows,run,uid,now,HttpError} from '../server';
import {isDate,type ChurchConfig,type ChurchContent} from './model';
import {countdownSeason} from './countdown';
import {formWithLimit,validateChurchPng} from './uploads';
import {churchHasSocialAttempt} from './scheduling';

// Countdown images are private image assets. Each date has one current template;
// prior bytes remain referenced by immutable published-post snapshots.
const kind=(date:string)=>'countdown:'+date;
const publicImage=(row:any)=>({id:row.id,date:row.kind.slice(10),occasion:countdownSeason(row.kind.slice(10)).occasion,revision:row.created,url:'/api/church/countdown-image/'+row.id+'?v='+encodeURIComponent(row.created)});
export async function countdownImages(owner:string,year:number){
 if(!Number.isInteger(year)||year<2000||year>2200)throw new HttpError(400,'Choose a valid year.');
 const list=await rows("SELECT id,kind,created FROM church_templates WHERE owner=? AND archived=0 AND kind>=? AND kind<=? ORDER BY kind",owner,kind((year-1)+'-12-26'),kind(year+'-12-25'));
 return {images:list.map(publicImage)};
}
export async function applyCountdownImage(owner:string,content:ChurchContent){
 if(content.series!=='christmas')return content;
 const image=await one('SELECT * FROM church_templates WHERE owner=? AND kind=? AND archived=0',owner,kind(content.date));
 if(image){content.countdownImage={id:image.id,key:image.png_key,date:content.date,occasion:countdownSeason(content.date).occasion,revision:image.created};delete content.christmasImage;delete content.canva;}
 return content;
}
export async function countdownImageBytes(owner:string,id:string){
 const row=await one("SELECT png_key FROM church_templates WHERE owner=? AND id=? AND archived=0 AND kind LIKE 'countdown:%'",owner,id);
 if(!row)throw new HttpError(404,'Countdown image not found.');const object=await E().BUCKET.get(row.png_key);if(!object)throw new HttpError(404,'Countdown image unavailable.');return object.body;
}
export async function uploadCountdownImage(owner:string,request:Request,config:ChurchConfig){
 const form=await formWithLimit(request),date=String(form.get('date')||''),expected=String(form.get('expectedRevision')||'');
 if(!isDate(date))throw new HttpError(400,'Choose a valid image date.');const season=countdownSeason(date);
 if(season.daysRemaining<0||season.daysRemaining>100)throw new HttpError(400,'Choose a Christmas or New Year countdown date.');
 const file=form.get('png');if(!(file instanceof File)||file.type!=='image/png')throw new HttpError(400,'Choose a PNG or JPG image.');
 const bytes=validateChurchPng(new Uint8Array(await file.arrayBuffer()));
 const old=await one('SELECT * FROM church_templates WHERE owner=? AND kind=? AND archived=0',owner,kind(date));
 if((old?.created||'')!==expected)throw new HttpError(409,'This image changed. Refresh the countdown images before replacing it.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner+'|'+date));
 const id='countdown-'+Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join(''),key=`${owner}/church-countdown/${id}-${uid()}.png`,revision=now()+'-'+uid();
 await E().BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/png'}});
 try{
  const saved=await run('INSERT INTO church_templates (id,owner,name,kind,png_key,pixels_key,size,created,archived) VALUES (?,?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET png_key=excluded.png_key,pixels_key=excluded.pixels_key,size=excluded.size,created=excluded.created WHERE church_templates.owner=? AND church_templates.png_key=?',id,owner,season.title+' · '+date,kind(date),key,key,bytes.length,revision,owner,old?.png_key||'');
  if(!saved.meta.changes)throw new HttpError(409,'This image changed while uploading. Refresh before replacing it.');
 }catch(error){await E().BUCKET.delete(key);throw error;}
 let updated=0;const cutoff=new Date(Date.now()-75*60000).toISOString();
 const pending=await rows("SELECT * FROM church_posts WHERE owner=? AND series='christmas' AND local_date=? AND scheduled>=? AND claimed IS NULL AND remote_id IS NULL AND status IN ('draft','scheduled','waiting_connection','paused','needs_review')",owner,date,cutoff);
 for(const row of pending){
  if(churchHasSocialAttempt(row))continue;const content=JSON.parse(row.payload);
  if(content.canva)content.retiredCanva=content.canva;delete content.canva;delete content.christmasImage;
  content.countdownImage={id,key,date,occasion:season.occasion,revision};
  const status=row.status==='needs_review'?config.autoPublish?'waiting_connection':'draft':row.status;
  const changed=await run("UPDATE church_posts SET payload=?,image_key=?,status=?,message=?,updated=? WHERE owner=? AND id=? AND payload=? AND status=? AND claimed IS NULL AND remote_id IS NULL",JSON.stringify(content),key,status,'Countdown image updated.',now(),owner,row.id,row.payload,row.status);updated+=changed.meta.changes;
 }
 return {saved:true,image:publicImage({id,kind:kind(date),created:revision}),updated,published:false};
}
