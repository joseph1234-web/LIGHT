import {E,one,run,uid,now,HttpError,log} from '../server';
import {churchConfig} from './server';

const allowedStates=['draft','scheduled','waiting_connection','paused'];
const maxSize=10*1024*1024;
export function validateChurchPng(bytes:Uint8Array){
 if(bytes.length>maxSize)throw new HttpError(413,'Export one PNG page up to 10 MB.');
 if(bytes.length<45||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw new HttpError(400,'Choose a finished PNG image exported from Canva, not a ZIP or template link.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let at=8,header=false,data=false,ended=false;
 while(at+12<=bytes.length){const size=v.getUint32(at),type=String.fromCharCode(...bytes.subarray(at+4,at+8));if(size>bytes.length-at-12)throw new HttpError(400,'The PNG file is incomplete. Export it again from Canva.');
  if(!header){if(type!=='IHDR'||size!==13)throw new HttpError(400,'The PNG header is invalid.');const w=v.getUint32(at+8),h=v.getUint32(at+12);if(w<32||h<32||w>4096||h>4096)throw new HttpError(400,'Export a PNG between 32 and 4096 pixels on each side.');header=true;}
  else if(type==='IHDR')throw new HttpError(400,'Choose one PNG image.');
  if(type==='acTL')throw new HttpError(400,'Export a static PNG page, not an animated PNG.');
  if(type==='IDAT'&&size>0)data=true;
  at+=size+12;if(type==='IEND'){if(size!==0||!data||at!==bytes.length)throw new HttpError(400,'The PNG image data is invalid.');ended=true;break;}
 }
 if(!header||!data||!ended)throw new HttpError(400,'The PNG file is incomplete. Export it again from Canva.');
 return bytes;
}
async function formWithLimit(request:Request){
 if(Number(request.headers.get('content-length')||0)>maxSize+128*1024)throw new HttpError(413,'Export one PNG page up to 10 MB.');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Choose the exported PNG.');const chunks:Uint8Array[]=[];let size=0;
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxSize+128*1024){await reader.cancel();throw new HttpError(413,'Export one PNG page up to 10 MB.');}chunks.push(part.value);}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
 try{return await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();}catch{throw new HttpError(400,'Choose a PNG using the image uploader.');}
}
export async function uploadChurchImage(owner:string,request:Request){
 const form=await formWithLimit(request),postId=String(form.get('postId')||''),renderId=String(form.get('renderId')||''),sourceUrl=String(form.get('sourceUrl')||'');
 if(form.get('contentVerified')!=='yes'||form.get('rightsConfirmed')!=='yes')throw new HttpError(400,'Preview the PNG and confirm its saved Canva source, current text, and design rights before attaching it.');
 const row=await one('SELECT * FROM church_posts WHERE owner=? AND id=?',owner,postId);if(!row)throw new HttpError(404,'Church post not found.');
 if(!allowedStates.includes(row.status)||row.remote_id||row.claimed)throw new HttpError(409,'This post has started or needs review. Check the original delivery before making changes.');
 if(new Date(row.scheduled).getTime()<Date.now()-75*60000)throw new HttpError(409,'This posting window expired. Choose an upcoming post; expired posts are never backfilled.');
 const content=JSON.parse(row.payload),c=content.canva,config=await churchConfig(owner);
 if(!c||c.renderId!==renderId||c.sourceUrl!==sourceUrl||config.canvaSources[row.series as keyof typeof config.canvaSources]!==sourceUrl)throw new HttpError(409,'The saved template or post changed. Reload the current post before uploading.');
 if(c.state!=='pending'||row.image_key)throw new HttpError(409,'This image is already attached or being prepared. Refresh the post instead of uploading again.');
 const enabled=row.series==='daily'?config.dailyEnabled:row.series==='service'?config.serviceEnabled:row.series==='christmas'?config.christmasEnabled:config.events.some(e=>e.id===row.event_id&&e.enabled);
 if(!enabled)throw new HttpError(409,'Enable and save this image series before preparing its posts.');
 const file=form.get('png');if(!(file instanceof File)||file.type!=='image/png')throw new HttpError(400,'Choose one PNG file exported from Canva.');
 const bytes=validateChurchPng(new Uint8Array(await file.arrayBuffer())),key=`${owner}/church/owner-canva-${row.id}-${renderId}-${uid()}.png`;
 await E().BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/png'}});
 try{
  const result=await run("UPDATE church_posts SET image_key=?,payload=json_set(payload,'$.canva.state','ready','$.canva.method','owner_upload','$.canva.verifiedBy','owner','$.canva.requiresManualReview',json('false'),'$.canva.verifiedAt',?),updated=? WHERE owner=? AND id=? AND image_key IS NULL AND remote_id IS NULL AND claimed IS NULL AND scheduled>=? AND json_extract(payload,'$.canva.renderId')=? AND json_extract(payload,'$.canva.sourceUrl')=? AND json_extract(payload,'$.canva.state')='pending' AND status IN ('draft','scheduled','waiting_connection','paused')",key,now(),now(),owner,postId,new Date(Date.now()-75*60000).toISOString(),renderId,sourceUrl);
  if(!result.meta.changes)throw new HttpError(409,'The post changed while uploading. Refresh it before taking another action.');
 }catch(e){await E().BUCKET.delete(key);throw e;}
 await log(owner,'A finished Canva PNG was attached to its church post after owner review.','church');
 return {saved:true,postId,imageReady:true,published:false};
}
