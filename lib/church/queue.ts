import {db,E,one,rows,run,now,uid,HttpError,log} from '../server';
import {churchConfig} from './server';
import {canClearChurchPost} from './scheduling';

/** Remove a schedule from the planner without discarding an uncertain delivery. */
export async function removeChurchPost(owner:string,input:any){
 if(typeof input?.id!=='string'||!input.id)throw new HttpError(400,'Choose a pending church post.');
 return clearChurchPending(owner,input.id);
}

export async function clearChurchPending(owner:string,postId?:string){
 const config:any=await churchConfig(owner);
 const token=uid(),stamp=Date.now(),locked=await one('INSERT INTO runner_locks (owner,token,expires) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE runner_locks.expires<? RETURNING owner',owner,token,stamp+120000,stamp);
 if(!locked)throw new HttpError(409,'A publishing check is running. Let it finish, then clear the pending schedules.');
 try{
 const all=postId?await rows("SELECT * FROM church_posts WHERE owner=? AND id=? AND status NOT IN ('published','removed')",owner,postId):await rows("SELECT * FROM church_posts WHERE owner=? AND status NOT IN ('published','removed') ORDER BY scheduled",owner);
 if(!postId&&!all.length){await run("UPDATE church_settings SET payload=json_set(payload,'$.manualQueue',json('true')),updated=? WHERE owner=?",now(),owner);return {deleted:0,archived:0,removed:0,protected:0,manualQueue:true,batchId:config.lastQueueClear?.batchId||null,undoAvailable:!!config.lastQueueClear&&!config.lastQueueClear.undone};}
 if(postId&&!all.length)throw new HttpError(409,'This post is already removed, published, or unavailable in your account.');
 const pending=all.filter(canClearChurchPost),batchId=uid(),created=now();
 // A private snapshot makes Clear reversible without discarding provider history.
 await E().BUCKET.put(`${owner}/church-queue-clears/${batchId}.json`,new TextEncoder().encode(JSON.stringify({owner,batchId,created,posts:all})),{httpMetadata:{contentType:'application/json'}});
 await run("UPDATE church_settings SET payload=json_set(payload,'$.manualQueue',json('true'),'$.lastQueueClear',json(?)),updated=? WHERE owner=?",JSON.stringify({batchId,count:all.length,created,scope:postId?'single':'all'}),created,owner);
 let deleted=0;
 for(let at=0;at<pending.length;at+=40){const batch=pending.slice(at,at+40);const results=await db().batch(batch.map(p=>db().prepare('DELETE FROM church_posts WHERE owner=? AND id=? AND status=? AND payload=? AND updated=? AND image_key IS ? AND claimed IS NULL AND remote_id IS NULL').bind(owner,p.id,p.status,p.payload,p.updated,p.image_key??null)));for(const result of results)deleted+=result.meta.changes||0;}
 // Retain every provider ID, including a render that started after the snapshot.
 // Removed is a terminal queue state, so no uploader can restart these records.
 let archived=0;
 for(let at=0;at<all.length;at+=40){
 const results=await db().batch(all.slice(at,at+40).map(p=>db().prepare("UPDATE church_posts SET payload=json_set(payload,'$.queueRemoval',json_object('batchId',?,'removedAt',?,'previousStatus',status)),status='removed',message='Removed from the queue. Existing upload and Canva records are kept in Removed history and will not be retried.',updated=? WHERE owner=? AND id=? AND status NOT IN ('published','removed')").bind(batchId,created,now(),owner,p.id)));
 for(const result of results)archived+=result.meta.changes||0;
 }
 await log(owner,`Removed ${deleted+archived} pending church schedules and uploads.`,'church');
 return {deleted,archived,removed:deleted+archived,protected:archived,manualQueue:true,batchId,undoAvailable:all.length>0};
 }finally{await run('DELETE FROM runner_locks WHERE owner=? AND token=?',owner,token);}
}

export async function undoChurchClear(owner:string,input:any){
 const config:any=await churchConfig(owner),batchId=input?.batchId;
 if(typeof batchId!=='string'||batchId!==config.lastQueueClear?.batchId)throw new HttpError(409,'Use this account’s latest queue clear.');
 const backup=await E().BUCKET.get(`${owner}/church-queue-clears/${batchId}.json`);if(!backup)throw new HttpError(409,'This queue-clear backup is unavailable.');
 const snapshot=JSON.parse(new TextDecoder().decode(await backup.arrayBuffer()));if(snapshot.owner!==owner||snapshot.batchId!==batchId||!Array.isArray(snapshot.posts))throw new HttpError(409,'This queue-clear backup does not match the account.');
 let restored=0;
 for(let at=0;at<snapshot.posts.length;at+=40){const batch=snapshot.posts.slice(at,at+40).filter((p:any)=>p.owner===owner&&canClearChurchPost(p));if(!batch.length)continue;const results=await db().batch(batch.map((p:any)=>db().prepare("INSERT INTO church_posts (id,owner,series,event_id,local_date,scheduled,payload,status,image_key,remote_id,page_id,message,claimed,created,updated) VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?,NULL,?,?) ON CONFLICT DO NOTHING").bind(p.id,owner,p.series,p.event_id,p.local_date,p.scheduled,p.payload,p.status==='cancelled'?'cancelled':Date.parse(p.scheduled)<Date.now()-75*60000?'skipped':'draft',p.image_key??null,p.page_id??null,'Restored from the cleared queue. Review before publishing.',p.created,now())));for(const result of results)restored+=result.meta.changes||0;}
 // Restoring provider history never re-arms a render or an upload.
 const history=await run("UPDATE church_posts SET status='needs_review',payload=json_remove(payload,'$.queueRemoval'),message='Restored for review. This upload or render will not be retried automatically.',updated=? WHERE owner=? AND status='removed' AND json_extract(payload,'$.queueRemoval.batchId')=? AND NOT EXISTS (SELECT 1 FROM church_posts active WHERE active.owner=church_posts.owner AND active.series=church_posts.series AND active.event_id=church_posts.event_id AND active.local_date=church_posts.local_date AND active.id<>church_posts.id AND active.status<>'removed')",now(),owner,batchId);
 restored+=history.meta.changes||0;
 await run("UPDATE church_settings SET payload=json_set(payload,'$.lastQueueClear.undone',json('true')),updated=? WHERE owner=? AND json_extract(payload,'$.lastQueueClear.batchId')=?",now(),owner,batchId);
 await log(owner,`Restored ${restored} church drafts from the cleared queue.`,'church');return {restored};
}

export async function restoreRemovedChurchPost(owner:string,input:any){
 if(typeof input?.id!=='string'||!input.id)throw new HttpError(400,'Choose a removed church post.');
 const result=await run("UPDATE church_posts SET status='needs_review',payload=json_remove(payload,'$.queueRemoval'),message='Restored for review. This upload or render will not be retried automatically.',updated=? WHERE owner=? AND id=? AND status='removed' AND NOT EXISTS (SELECT 1 FROM church_posts active WHERE active.owner=church_posts.owner AND active.series=church_posts.series AND active.event_id=church_posts.event_id AND active.local_date=church_posts.local_date AND active.id<>church_posts.id AND active.status<>'removed')",now(),owner,input.id);
 if(!result.meta.changes)throw new HttpError(409,'This removed record is unavailable or a new schedule already uses its date.');
 return {restored:true};
}

export async function resumeChurchPreparation(owner:string){
 await churchConfig(owner);await run("UPDATE church_settings SET payload=json_set(payload,'$.manualQueue',json('false')),updated=? WHERE owner=?",now(),owner);
}
