/** A read-only view of church records in the main publishing queue. */
export function churchPublishingItem(row:any,clock=Date.now()){
 const content=JSON.parse(row.payload),canva=content.canva,expired=Date.parse(row.scheduled)<clock-75*60000&&['draft','scheduled','waiting_connection','paused'].includes(row.status);
 const imageReady=!!row.image_key||!!content.christmasImage?.available||!canva&&!content.christmasImage;
 const imageState=imageReady?'Image ready':content.christmasImage?'Uploaded countdown image missing':canva?.requiresManualReview||canva?.phase==='needs_review'?'Canva needs attention':canva?.phase==='awaiting_verification'?'Checking Canva PNG':canva?.state==='rendering'?'Canva image generating':'Canva image queued';
 return {id:'church:'+row.id,churchPostId:row.id,source:'church',series:row.series,title:content.title,mediaType:'image',platform:'facebook',status:expired?'skipped':({scheduled:'queued',waiting_connection:'blocked',outdated:'needs_review'} as Record<string,string>)[row.status]||row.status,scheduled:row.scheduled,remote_id:row.remote_id,message:[expired?'Posting window passed. No catch-up will be sent.':imageState,row.message,canva?.error].filter(Boolean).join(' · '),imageReady,created:row.created,updated:row.updated};
}
