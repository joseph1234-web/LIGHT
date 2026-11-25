import {rows,run,now} from '../server';
import {DAILY_INSPIRATION_VERSION,morningVerse,morningCaption,monthlyTheme,captionWithoutMonthlyTheme} from './monthly-inspiration';
import {churchHasSocialAttempt} from './scheduling';
import type {ChurchConfig} from './model';

export async function syncDailyInspiration(owner:string,config:ChurchConfig){
 const posts=await rows("SELECT * FROM church_posts WHERE owner=? AND series='daily' AND scheduled>=? AND claimed IS NULL AND remote_id IS NULL AND status IN ('draft','scheduled','waiting_connection','paused')",owner,new Date(Date.now()-75*60000).toISOString());
 for(const row of posts){
  const content=JSON.parse(row.payload);if(content.dailyInspiration?.version===DAILY_INSPIRATION_VERSION||churchHasSocialAttempt(row))continue;
  if(content.edited){
   const caption=captionWithoutMonthlyTheme(content.caption||'');if(caption!==content.caption)await run("UPDATE church_posts SET payload=json_set(payload,'$.caption',?),updated=? WHERE owner=? AND id=? AND payload=? AND status=? AND claimed IS NULL AND remote_id IS NULL",caption,now(),owner,row.id,row.payload,row.status);
   continue;
  }
  const render=content.canva,unstarted=!row.image_key&&(!render||render.state==='pending'&&!render.claimToken&&!render.designId&&!render.autofillJobId&&!render.exportJobId&&!render.phase&&!render.pageReservation);
  // Confirmed image text stays paired with its design; only its surrounding caption changes.
  if(unstarted)content.spec.verse=morningVerse(row.local_date,config.bibleVersion);
  content.caption=morningCaption(content.spec.brand||config.churchName,row.local_date,content.spec.verse);
  content.dailyInspiration={version:DAILY_INSPIRATION_VERSION,month:monthlyTheme(row.local_date).month,theme:monthlyTheme(row.local_date).title};
  await run("UPDATE church_posts SET payload=?,updated=? WHERE owner=? AND id=? AND payload=? AND status=? AND claimed IS NULL AND remote_id IS NULL",JSON.stringify(content),now(),owner,row.id,row.payload,row.status);
 }
}
