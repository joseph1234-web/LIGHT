export const platforms = ['facebook','instagram','tiktok','youtube'] as const;
export type Platform = typeof platforms[number];
export type Draft = {
 id:string; mediaType:'video'|'image'; title:string; topic:string; script:string; captions:Record<string,string>; platforms:Platform[];
 assetId:string; rights:'unreviewed'|'original'|'licensed'|'permission'|'public-domain'; rightsNote:string;
 music:'unreviewed'|'none'|'original'|'licensed'; musicNote:string; attribution:string; approved:boolean;
 sourceUrl:string; originCountry:string; originEvidence:string; englishReviewed:boolean; publicVideoUrl:string; privacy:'public'|'unlisted'|'private'; madeForKids:boolean|null;
 synthetic:boolean; created?:string; updated?:string;
};
export const defaultSettings = {
 brand:'My creator studio', tone:'Friendly', language:'English', niche:'All topics', region:'US', timezone:'Asia/Manila',
 hashtags:'#Shorts #DiscoverMore', autopilot:false, autoPictures:false, autoVideos:true, slots:['09:00','18:00'], autoPlatforms:['facebook','instagram','youtube'],
 runnerVerifiedAt:'', lastRun:'',
};
export const starterIdeas = [
 {id:'reset',title:'The 5-minute reset',topic:'Small habits that make a big difference',category:'Lifestyle',region:'US',duration:'25–35 sec',style:'reset',source:'Starter idea',hook:'A fresh start can be smaller than you think.',script:'A fresh start can be smaller than you think.\nChoose one small space and clear it.\nWrite down one thing you want to finish today.\nPut your phone aside and give it five focused minutes.\nWhat is one small thing you can reset today?'},
 {id:'science',title:'Everyday, explained.',topic:'Explain one everyday science observation',category:'Education',region:'GB',duration:'20–30 sec',style:'science',source:'Starter idea',hook:'Something ordinary. One good question.',script:'Something ordinary. One good question.\nChoose an everyday observation you can film yourself.\nAsk why it happens, then verify the explanation with a reliable source.\nShow your own simple demonstration.\nWhat should we investigate next?'},
 {id:'coffee',title:'Make the ordinary better.',topic:'A personal morning routine filmed from your perspective',category:'Lifestyle',region:'AU',duration:'15–25 sec',style:'coffee',source:'Starter idea',hook:'One tiny ritual. A different kind of morning.',script:'One tiny ritual. A different kind of morning.\nThis is how I make a little space before my day begins.\nFilm your own routine and describe what you actually do.\nKeep the moment simple and the footage yours.\nWhat is your morning ritual?'},
 {id:'learn',title:'One thing I wish I knew.',topic:'A skill you learned through your own experience',category:'Learning',region:'CA',duration:'25–40 sec',style:'learn',source:'Starter idea',hook:'Here is one thing I wish I had learned sooner.',script:'Here is one thing I wish I had learned sooner.\nShare one specific lesson from your own experience.\nShow what you used to do and demonstrate your improved approach.\nGive one practical step a beginner can try.\nWhat would you add?'}
];
export function createCaption(title:string,topic:string,tone:string,language:string,hashtags:string,attribution=''){
 const tagalog=language==='Taglish';
 const hook=tagalog?`Small idea, malaking difference. ✨`:tone==='Professional'?`A practical perspective on ${topic.toLowerCase()}.`:tone==='Inspiring'?`Small steps. Fresh perspective. ✨`:`A little inspiration for your next scroll. ✨`;
 const body=tagalog?`${title}\n\n${hook}\nAnong thoughts mo? Share mo sa comments.`:`${title}\n\n${hook}\nWhat would you try? Tell me in the comments.`;
 return Object.fromEntries(platforms.map(p=>[p,`${body}${attribution?'\n\n'+attribution:''}\n\n${hashtags}${p==='youtube'&&!hashtags.includes('#Shorts')?' #Shorts':''}`.trim()]));
}
export function rightsIssues(d:Draft){
 const a:string[]=[];
 if(!d.assetId)a.push('Upload your finished picture or video.');
 if(d.rights!=='original'){
 if(!['US','GB','CA','AU','NZ','IE','SG','ZA'].includes(d.originCountry))a.push('Record a source country outside the Philippines.');
 if(!d.originEvidence?.trim())a.push('Record evidence that the media comes from the selected foreign country.');
 if(!d.englishReviewed)a.push('Confirm the content is in English.');
 }
 if(d.rights==='unreviewed')a.push('Declare the media rights.');
 if(!d.rightsNote.trim())a.push('Add the ownership or license details.');
 if(d.mediaType!=='image'&&d.music==='unreviewed')a.push('Review the audio rights.');
 if(d.mediaType!=='image'&&d.music==='licensed'&&!d.musicNote.trim())a.push('Add the music license details.');
 if(!d.approved)a.push('Review and approve this exact media and its captions.');
 return a;
}
export function validateDraft(input:any):Draft {
 const str=(x:any,max=15000)=>typeof x==='string'?x.slice(0,max):'';
 const ps=Array.isArray(input.platforms)?input.platforms.filter((x:Platform)=>platforms.includes(x)):[];
 const rights=['unreviewed','original','licensed','permission','public-domain'].includes(input.rights)?input.rights:'unreviewed';
 const music=['unreviewed','none','original','licensed'].includes(input.music)?input.music:'unreviewed';
 return {id:str(input.id,80),mediaType:input.mediaType==='image'?'image':'video',title:str(input.title,100),topic:str(input.topic,500),script:str(input.script,8000),captions:Object.fromEntries(platforms.map(p=>[p,str(input.captions?.[p],p==='youtube'?4800:2100)])),platforms:ps,assetId:str(input.assetId,80),rights,rightsNote:str(input.rightsNote,2000),music,musicNote:str(input.musicNote,2000),attribution:str(input.attribution,1500),approved:input.approved===true,sourceUrl:str(input.sourceUrl,2000),originCountry:str(input.originCountry,2),originEvidence:str(input.originEvidence,2000),englishReviewed:input.englishReviewed===true,publicVideoUrl:str(input.publicVideoUrl,2000),privacy:['public','unlisted','private'].includes(input.privacy)?input.privacy:'private',madeForKids:typeof input.madeForKids==='boolean'?input.madeForKids:null,synthetic:input.synthetic===true};
}
export function emptyDraft():Draft{return {id:'',mediaType:'video',title:'',topic:'',script:'',captions:{facebook:'',instagram:'',tiktok:'',youtube:''},platforms:['facebook','instagram','youtube'],assetId:'',rights:'unreviewed',rightsNote:'',music:'unreviewed',musicNote:'',attribution:'',approved:false,sourceUrl:'',originCountry:'',originEvidence:'',englishReviewed:false,publicVideoUrl:'',privacy:'private',madeForKids:null,synthetic:false}}
