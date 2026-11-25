import { E, db, rows, one, run, now, uid, settings, saveSettings, log, unseal, seal, apiFetch, getDraft, queueDraft, HttpError, appConfiguration } from './server';
import { rightsIssues, type Draft } from './model';
import {processChurchPosts} from './church/server';
import {churchCanvaJobs} from './church/canva';
import {runAutomaticCanva} from './church/canva-automation';
import {dateInZone,addDays,zonedTime,isTime} from './church/model';
async function token(owner:string,platform:string){const c=await one('SELECT * FROM connections WHERE owner=? AND platform=?',owner,platform);if(!c)throw new HttpError(400,`Reconnect ${platform} to continue.`);let secret=await unseal(c.secret);const app=await appConfiguration(owner);
 if(platform==='youtube'&&(!secret.expiresAt||new Date(secret.expiresAt).getTime()<Date.now()+120000)){
 const e=app,t=await apiFetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:e.GOOGLE_CLIENT_ID,client_secret:e.GOOGLE_CLIENT_SECRET,refresh_token:secret.refresh_token,grant_type:'refresh_token'})});
 secret={...secret,...t,expiresAt:new Date(Date.now()+t.expires_in*1000).toISOString()};await run('UPDATE connections SET secret=?,expires=? WHERE id=? AND owner=?',await seal(secret),secret.expiresAt,c.id,owner);
 }if(platform==='instagram'&&secret.provider==='instagram'&&secret.expiresAt&&new Date(secret.expiresAt).getTime()<Date.now()+7*86400000){const fresh=await apiFetch('https://graph.instagram.com/refresh_access_token?'+new URLSearchParams({grant_type:'ig_refresh_token',access_token:secret.access_token}));secret={...secret,...fresh,expiresAt:new Date(Date.now()+fresh.expires_in*1000).toISOString()};await run('UPDATE connections SET secret=?,expires=? WHERE owner=? AND id=?',await seal(secret),secret.expiresAt,owner,c.id);}
 return {account:c.account_id,access:secret.access_token,graph:platform==='instagram'&&secret.provider==='instagram'?`https://graph.instagram.com/${app.INSTAGRAM_GRAPH_VERSION}`:`https://graph.facebook.com/${app.META_GRAPH_VERSION}`};}

async function patch(job:any,status:string,message:string,remoteId?:string,payload?:any){await run('UPDATE jobs SET status=?,message=?,remote_id=COALESCE(?,remote_id),payload=COALESCE(?,payload),updated=? WHERE id=? AND owner=?',status,message,remoteId||null,payload?JSON.stringify(payload):null,now(),job.id,job.owner);}
function trustedUpload(value:string,root:string){const u=new URL(value);if(u.protocol!=='https:'||!(u.hostname===root||u.hostname.endsWith('.'+root)))throw new Error('The platform returned an unexpected upload endpoint.');return value;}
async function publish(job:any){
 const d=JSON.parse(job.payload) as Draft;if(rightsIssues(d).length)throw new Error('The stored post is missing its rights review.');
 const a=await one('SELECT * FROM assets WHERE owner=? AND id=?',job.owner,d.assetId);if(!a)throw new Error('The approved media is unavailable.');
 const {account,access,graph}=await token(job.owner,job.platform),e=E();
 if(!(d as any)._targetAccountId||(d as any)._targetAccountId!==account)throw new Error('The publishing account changed or was not recorded. Review and reschedule this delivery.');
 if((d as any)._autopilot){const prefs=await settings(job.owner);if(!prefs.autopilot||(d.mediaType==='image'?!prefs.autoPictures:prefs.autoVideos===false))throw new Error('This media automation is paused. Review the delivery before rescheduling.');}
 const caption=d.captions[job.platform];
 if(job.platform==='youtube'){
 const res=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json','X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(a.size)},body:JSON.stringify({snippet:{title:d.title,description:caption,defaultLanguage:'en',categoryId:'22'},status:{privacyStatus:d.privacy,selfDeclaredMadeForKids:d.madeForKids,containsSyntheticMedia:d.synthetic}}),signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw new Error('YouTube could not initialize the upload. Check the account connection and quota.');const location=res.headers.get('location');if(!location)throw new Error('YouTube did not provide an upload session.');trustedUpload(location,'googleapis.com');
 const obj=await e.BUCKET.get(a.key);if(!obj)throw new Error('Video file is unavailable.');
 const upload=await fetch(location,{method:'PUT',headers:{'Content-Type':'video/mp4','Content-Length':String(a.size)},body:obj.body,signal:AbortSignal.timeout(55000)});
 if(!upload.ok)throw new Error('YouTube upload was not confirmed. Review YouTube Studio before retrying.');const v:any=await upload.json();if(!v.id)throw new Error('YouTube did not confirm a video ID.');
 await patch(job,'processing','Uploaded to YouTube. Waiting for video processing.',v.id);return;
 }
 if(job.platform==='facebook'&&d.mediaType==='image'){
 const object=await e.BUCKET.get(a.key);if(!object)throw new Error('Picture is unavailable.');const form=new FormData();form.set('source',new Blob([await object.arrayBuffer()],{type:a.mime}),'picture.png');form.set('caption',caption);form.set('published','true');
 const result=await apiFetch(`${graph}/${account}/photos`,{method:'POST',headers:{Authorization:`Bearer ${access}`},body:form});if(!result.id)throw new Error('Facebook did not confirm the picture upload. Review the Page before retrying.');await patch(job,result.post_id?'published':'processing',result.post_id?'Facebook confirmed the picture post.':'Picture uploaded. Waiting for Page post confirmation.',String(result.post_id||result.id),{...d,_phase:'photo',_photoId:String(result.id)});return;
 }
 if(job.platform==='facebook'){
 const base=graph;
 const start=await apiFetch(`${base}/${account}/video_reels`,{method:'POST',headers:{Authorization:`Bearer ${access}`},body:new URLSearchParams({upload_phase:'start'})});
 if(!start.video_id||!start.upload_url)throw new Error('Facebook did not initialize a Reel.');
 await patch(job,'uploading','Facebook accepted the upload session.',start.video_id,{...d,_phase:'upload'});
 const obj=await e.BUCKET.get(a.key);if(!obj)throw new Error('Video file is unavailable.');
 const uploadHost=new URL(start.upload_url).hostname;if(uploadHost.endsWith('.facebook.com'))trustedUpload(start.upload_url,'facebook.com');else trustedUpload(start.upload_url,'fbcdn.net');
 const sent=await apiFetch(start.upload_url,{method:'POST',headers:{Authorization:`OAuth ${access}`,offset:'0',file_size:String(a.size),'Content-Type':'application/octet-stream'},body:obj.body});
 if(!sent.success)throw new Error('Facebook did not confirm the media upload.');
 await patch(job,'processing','Waiting for Facebook video processing.',start.video_id,{...d,_phase:'finish'});
 // A later runner checks processing before finishing this exact upload.
 return;
 }
 if(job.platform==='instagram'){
 const u=new URL(d.publicVideoUrl);if(u.protocol!=='https:')throw new Error('Instagram requires a public HTTPS URL for this media.');
 const base=graph;
 const container=await apiFetch(`${base}/${account}/media`,{method:'POST',headers:{Authorization:`Bearer ${access}`},body:new URLSearchParams(d.mediaType==='image'?{image_url:d.publicVideoUrl,caption}:{media_type:'REELS',video_url:d.publicVideoUrl,caption,share_to_feed:'true'})});
 if(!container.id)throw new Error('Instagram did not confirm a container.');await patch(job,'processing','Instagram is processing the media.',container.id,{...d,_phase:'container'});return;
 }
 throw new Error('TikTok requires manual publishing from the export screen.');
}
async function reconcile(job:any){
 if(!job.remote_id)return;
 const {account,access,graph}=await token(job.owner,job.platform),d=JSON.parse(job.payload),e=E();
 if(!d._targetAccountId||d._targetAccountId!==account)throw new Error('The connected account changed. Review the original account before continuing.');
 if(job.platform==='youtube'){
 const v=await apiFetch('https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id='+encodeURIComponent(job.remote_id),{headers:{Authorization:`Bearer ${access}`}});
 const data=v.items?.[0];if(!data){await patch(job,'needs_review','The uploaded video could not be found. Check YouTube Studio.');return;}
 if(data.status?.uploadStatus==='processed'||data.processingDetails?.processingStatus==='succeeded'){await patch(job,'published',`YouTube confirmed processing · ${data.status.privacyStatus}`);await log(job.owner,`Published on YouTube: ${d.title}`,'published');}
 else if(['failed','rejected','deleted'].includes(data.status?.uploadStatus))await patch(job,'failed','YouTube could not process this video. Check YouTube Studio.');
 return;
 }
 const base=graph;
 if(job.platform==='instagram'){
 if(d._phase==='publishing'){await patch(job,'needs_review','Instagram publish response was not confirmed. Review the account before retrying.');return;}
 const c=await apiFetch(`${base}/${job.remote_id}?fields=status_code`,{headers:{Authorization:`Bearer ${access}`}});
 if(c.status_code==='FINISHED'){
 await patch(job,'processing','Submitting the processed post to Instagram.',undefined,{...d,_phase:'publishing'});
 const result=await apiFetch(`${base}/${account}/media_publish`,{method:'POST',headers:{Authorization:`Bearer ${access}`},body:new URLSearchParams({creation_id:job.remote_id})});
 if(!result.id)throw new Error('Instagram did not confirm publication.');await patch(job,'published','Instagram confirmed publication.',result.id,{...d,_phase:'published'});await log(job.owner,`Published on Instagram: ${d.title}`,'published');
 }else if(['ERROR','EXPIRED'].includes(c.status_code))await patch(job,'failed','Instagram could not process this media. Check its format and public media URL.');return;
 }
 if(job.platform==='facebook'&&d.mediaType==='image'){const photo=await apiFetch(`${base}/${d._photoId||job.remote_id}?fields=id,page_story_id`,{headers:{Authorization:`Bearer ${access}`}});if(photo.page_story_id)await patch(job,'published','Facebook confirmed the picture post.',String(photo.page_story_id));else if(Date.now()-new Date(job.created).getTime()>2*3600000)await patch(job,'needs_review','Picture upload was confirmed but the Page post was not. Review Facebook before retrying.');return;}
 if(job.platform==='facebook'){
 const r=await apiFetch(`${base}/${job.remote_id}?fields=status`,{headers:{Authorization:`Bearer ${access}`}}),s=r.status;
 if(s?.publishing_phase?.status==='complete'){await patch(job,'published','Facebook confirmed publication.');await log(job.owner,`Published on Facebook: ${d.title}`,'published');return;}
 if(s?.video_status==='error'||s?.processing_phase?.status==='error'){await patch(job,'failed','Facebook could not process this Reel.');return;}
 if(d._phase==='finish'&&(s?.video_status==='ready'||s?.processing_phase?.status==='complete')){
 await patch(job,'processing','Finishing the Facebook Reel.',undefined,{...d,_phase:'submitted'});
 const v=await apiFetch(`${base}/${account}/video_reels`,{method:'POST',headers:{Authorization:`Bearer ${access}`},body:new URLSearchParams({upload_phase:'finish',video_id:job.remote_id,video_state:'PUBLISHED',title:d.title,description:d.captions.facebook})});
 if(!v.success)throw new Error('Facebook did not confirm the publish request.');
 }return;
 }
}
export function dueMediaSlots(clock:Date,timezone:string,slots:string[]){
 const today=dateInZone(clock,timezone),days=[addDays(today,-1),today],due:{day:string;slot:string}[]=[];
 for(const day of days)for(const slot of slots){if(!isTime(slot))continue;const elapsed=clock.getTime()-Date.parse(zonedTime(day,slot,timezone));if(elapsed>=0&&elapsed<60*60000)due.push({day,slot});}
 return due;
}
async function fillSlots(owner:string){
 const s=await settings(owner);if(!s.autopilot||!s.runnerVerifiedAt)return 0;
 const clock=new Date(),today=dateInZone(clock,s.timezone),recentDays=[today,addDays(today,-1)];
 const connected=await rows('SELECT platform FROM connections WHERE owner=?',owner),allowed=s.autoPlatforms.filter((v:string)=>v!=='tiktok'&&connected.some(c=>c.platform===v));if(!allowed.length)return 0;
 const types=[...(s.autoPictures?['image']:[]),...(s.autoVideos!==false?['video']:[])];let count=0;
 for(const {day,slot} of dueMediaSlots(clock,s.timezone,s.slots)){
 for(const type of types){const marker=`${day}-${slot}-${type}`;if(s.consumedSlots?.includes(marker))continue;
 const list=await rows('SELECT * FROM drafts WHERE owner=? ORDER BY created ASC LIMIT 250',owner);
 for(const row of list){const d=JSON.parse(row.payload) as Draft;if((d.mediaType||'video')!==type||rightsIssues(d).length||await one('SELECT id FROM jobs WHERE owner=? AND draft_id=?',owner,row.id))continue;if(!d.platforms.some(p=>allowed.includes(p)))continue;
 try{await queueDraft(owner,row.id,new Date(Date.now()+1000).toISOString(),true);count++;s.consumedSlots=[...(s.consumedSlots||[]).filter((x:string)=>recentDays.some(d=>x.startsWith(d+'-'))),marker];await saveSettings(owner,s);}catch(error){await log(owner,`Autopilot skipped ${d.title}: ${(error as Error).message}`,'attention');}break;
 }}}
 return count;
}
export async function runQueue(owner:string,unattended=false){
 const lockToken=uid(),stamp=Date.now();
 const acquired=await one('INSERT INTO runner_locks (owner,token,expires) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE runner_locks.expires<? RETURNING owner',owner,lockToken,stamp+10*60000,stamp);
 if(!acquired)return {processed:0,filled:0,message:'A publishing check is already running.'};
 try{return await runLockedQueue(owner,unattended)}finally{await run('DELETE FROM runner_locks WHERE owner=? AND token=?',owner,lockToken)}
}
async function runLockedQueue(owner:string,unattended=false){
 if(unattended){const s=await settings(owner);s.runnerVerifiedAt=now();await saveSettings(owner,s);}
 const canvaGeneration=await runAutomaticCanva(owner);
 const church=await processChurchPosts(owner);
 const filled=await fillSlots(owner);
 // A stale upload is ambiguous. Never blindly send it again.
 await run("UPDATE jobs SET status='needs_review',message='Upload was interrupted. Check the platform before creating another delivery.',updated=? WHERE owner=? AND status='uploading' AND claimed<?",now(),owner,new Date(Date.now()-10*60000).toISOString());
 let processed=0;const pending=await rows("SELECT * FROM jobs WHERE owner=? AND status='processing' ORDER BY updated ASC LIMIT 6",owner);
 for(const j of pending){const claim=await run("UPDATE jobs SET claimed=? WHERE id=? AND owner=? AND status='processing' AND (claimed IS NULL OR claimed<?)",now(),j.id,owner,new Date(Date.now()-120000).toISOString());if(!claim.meta.changes)continue;
 try{await reconcile(j);processed++;}catch(error){await patch(j,'needs_review',(error as Error).message);} }
 await run("UPDATE jobs SET status='skipped',message='Posting window passed. No automatic catch-up was sent.',updated=? WHERE owner=? AND status='queued' AND scheduled<?",now(),owner,new Date(Date.now()-75*60000).toISOString());
 const due=await rows("SELECT * FROM jobs WHERE owner=? AND status='queued' AND scheduled<=? ORDER BY scheduled ASC LIMIT 3",owner,now());
 for(const j of due){const claim=await run("UPDATE jobs SET status='uploading',claimed=?,updated=? WHERE id=? AND owner=? AND status='queued'",now(),now(),j.id,owner);if(!claim.meta.changes)continue;
 try{await publish(j);processed++;}catch(error){await patch(j,'needs_review',(error as Error).message);await log(owner,`Needs review: ${JSON.parse(j.payload).title} · ${(error as Error).message}`,'attention');}}
 const s=await settings(owner);s.lastRun=now();await saveSettings(owner,s);return {processed,filled,church:{...church,canvaGeneration,canva:await churchCanvaJobs(owner,false)},lastRun:s.lastRun};
}
