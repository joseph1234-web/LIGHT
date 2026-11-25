import {E,rows,run,now,HttpError} from '../server';
import {christmasPackImage,christmasPack} from './christmas-pack';
import {churchHasSocialAttempt} from './scheduling';
import type {ChurchConfig} from './model';

export async function syncChristmasPack(owner:string,c:ChurchConfig){
 if(c.christmasImageSource!=='uploaded_pack')return;
 const list=await rows("SELECT * FROM church_posts WHERE owner=? AND series='christmas' AND scheduled>=? AND claimed IS NULL AND remote_id IS NULL AND status IN ('draft','scheduled','waiting_connection','paused','needs_review')",owner,new Date(Date.now()-75*60000).toISOString());
 for(const row of list){
  const content=JSON.parse(row.payload);if(churchHasSocialAttempt(row)||content.christmasImage?.packId===christmasPack.id)continue;
  const selected=christmasPackImage(row.local_date);
  if(content.canva){if(content.retiredCanva&&content.retiredCanva.renderId!==content.canva.renderId)content.retiredCanvaHistory=[...(content.retiredCanvaHistory||[]),content.retiredCanva];content.retiredCanva=content.canva;}delete content.canva;if(content.christmasImage)content.retiredChristmasImage=content.christmasImage;content.christmasImage=selected;
  const status=!selected.available?'needs_review':row.status==='needs_review'?(c.autoPublish?'scheduled':'draft'):row.status;
  await run("UPDATE church_posts SET payload=?,image_key=NULL,status=?,message=?,updated=? WHERE owner=? AND id=? AND payload=? AND status=? AND claimed IS NULL AND remote_id IS NULL",JSON.stringify(content),status,selected.available?'Uploaded Christmas image matched to the saved countdown date.':selected.reason,now(),owner,row.id,row.payload,row.status);
 }
}

export async function uploadedChristmasPng(date:string,expected?:{packId:string;sha256:string|null}){
 const selected=christmasPackImage(date);if(!selected.available||!selected.path||!selected.sha256)throw new HttpError(409,selected.reason);
 if(expected&&(expected.packId!==selected.packId||expected.sha256!==selected.sha256))throw new HttpError(409,'This post retains an earlier Christmas image pack. Its saved image will not be replaced or reposted.');
 const assets=E().ASSETS;if(!assets?.fetch)throw new HttpError(503,'The uploaded Christmas image pack is unavailable. No replacement image was generated.');
 // Use a local authority accepted by the development asset binding. The binding
 // serves only packaged assets; this never performs an external network fetch.
 const response=await assets.fetch(new Request('http://localhost'+selected.path));
 if(!response.ok)throw new HttpError(503,'The matching uploaded Christmas PNG is unavailable.');
 const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>10*1024*1024)throw new HttpError(413,'The uploaded Christmas PNG is too large.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 if(hash!==selected.sha256)throw new HttpError(409,'The uploaded Christmas PNG does not match the inspected source file.');
 return {bytes,selected};
}
