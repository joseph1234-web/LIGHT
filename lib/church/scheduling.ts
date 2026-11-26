const editable=['draft','scheduled','waiting_connection','paused'];
export function confirmedCanvaReview(render:any){
 if(render?.state!=='rendering'||render.phase!=='awaiting_verification'||render.requiresManualReview||!render.claimToken||!render.designId||!render.exportJobId||render.designId===render.sourceDesignId)return false;
 try{const url=new URL(render.exportUrl);return url.protocol==='https:'&&url.hostname.endsWith('.canva.com')&&!url.username&&!url.password;}catch{return false;}
}

export function churchHasSocialAttempt(row:any){
 if(row.claimed!=null||row.remote_id!=null||['uploading','processing','published'].includes(row.status))return true;
 let content:any;try{content=JSON.parse(row.payload)}catch{return true;}
 if(content._photoId||['uploading','processing','published'].includes(content.cancelledFrom)||['uploading','processing','published'].includes(content.queueRemoval?.previousStatus))return true;
 return !content.canva&&!content.christmasImage&&!content.countdownImage&&(row.status==='needs_review'||content.queueRemoval?.previousStatus==='needs_review');
}

/** A cancelled draft can return only through an explicit scheduling action. */
export function churchScheduleBlock(row:any,restoreCancelled=false,clock=Date.now()){
 if(!row)return '';
 if(row.status==='removed')return 'This date has a removed upload or Canva render. Choose another date to avoid repeating a started operation.';
 const cancelled=row.status==='cancelled';
 if(cancelled&&!restoreCancelled)return 'This post is cancelled. Choose Reschedule on its card to restore it.';
 if(!editable.includes(row.status)&&!cancelled)return 'This post has started delivery or needs review. Scheduling cannot restart it.';
 if(!Number.isFinite(Date.parse(row.scheduled))||Date.parse(row.scheduled)<clock-75*60000)return 'The original posting window expired. Choose another future date; expired posts cannot be restored.';
 let content:any;try{content=JSON.parse(row.payload)}catch{return 'This post needs review before its schedule can change.';}
 if(row.claimed!=null||row.remote_id!=null||content._photoId)return 'This post has an upload or delivery to review. Scheduling cannot send it again.';
 if(cancelled&&content.cancelledFrom&&!editable.includes(content.cancelledFrom))return 'This post was cancelled after a review or expired window. It cannot be restored automatically.';
 const c=content.canva;
 if(c?.state==='rendering'&&!confirmedCanvaReview(c)||c?.state==='pending'&&(c.claimToken||c.designId||c.autofillJobId||c.exportJobId||c.pageReservation||c.phase))return 'A Canva render has already started. Review its saved job before changing this schedule.';
 if(c&&(c.state==='ready'&&!row.image_key||row.image_key&&c.state!=='ready'))return 'This image needs review before its schedule can change.';
 return '';
}

export function canClearChurchPost(row:any){
 if(!['draft','scheduled','waiting_connection','paused','outdated','cancelled','skipped'].includes(row.status)||row.claimed!=null||row.remote_id!=null)return false;
 let content:any;try{content=JSON.parse(row.payload)}catch{return false;}
 if(content.retiredCanva)return false;
 if(content._photoId||['needs_review','uploading','processing','published'].includes(content.cancelledFrom))return false;
 const c=content.canva;
 return !c||c.state==='pending'&&!c.claimToken&&!c.designId&&!c.autofillJobId&&!c.exportJobId&&!c.pageReservation&&!c.sourceDesignId&&!c.phase;
}
