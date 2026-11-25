import { E, apiFetch } from './server';
import { starterIdeas } from './model';
export async function discover(region:string,query:string){
 if(!['US','GB','AU','CA'].includes(region))region='US';
 const key=E().YOUTUBE_API_KEY;
 if(!key)return {mode:'starter',message:'Starter concepts only. Live foreign-content discovery needs a YouTube API key. No foreign origin or popularity is asserted for these concepts.',items:starterIdeas.filter(x=>!query||(`${x.title} ${x.topic} ${x.category}`).toLowerCase().includes(query.toLowerCase()))};
 try{
 // Geography is verified from channel metadata, not inferred from where a video trends.
 // Use licensed search candidates, then check the exact video and channel metadata.
 const search=new URL('https://www.googleapis.com/youtube/v3/search');Object.entries({part:'snippet',type:'video',order:'viewCount',relevanceLanguage:'en',videoDuration:'short',videoLicense:'creativeCommon',maxResults:'50',q:query||'English',regionCode:region,key}).forEach(([k,v])=>search.searchParams.set(k,String(v)));
 const candidates=await apiFetch(search.toString());const ids=(candidates.items||[]).map((v:any)=>v.id.videoId).filter(Boolean);
 if(!ids.length)return {mode:'live',message:'No candidate videos found. Try another topic. Only known foreign source countries are accepted.',items:[],fetchedAt:new Date().toISOString()};
 const videos=await apiFetch('https://www.googleapis.com/youtube/v3/videos?'+new URLSearchParams({part:'snippet,statistics,status',id:ids.join(','),key}));
 const channelIds=Array.from(new Set((videos.items||[]).map((v:any)=>v.snippet.channelId))) as string[];
 const channels=await apiFetch('https://www.googleapis.com/youtube/v3/channels?'+new URLSearchParams({part:'snippet',id:channelIds.join(','),key}));
 const countries=new Map((channels.items||[]).map((c:any)=>[c.id,c.snippet.country]));
 const items=(videos.items||[]).filter((v:any)=>{
 const country=countries.get(v.snippet.channelId);const language=String(v.snippet.defaultAudioLanguage||'').toLowerCase();
 return country===region&&country!=='PH'&&language.startsWith('en')&&v.status?.license==='creativeCommon';
 }).map((v:any,i:number)=>({id:v.id,title:v.snippet.title,topic:v.snippet.title,category:'Foreign content',region,originCountry:countries.get(v.snippet.channelId),channelUrl:'https://www.youtube.com/channel/'+v.snippet.channelId,license:v.status.license,source:'YouTube API',sourceUrl:'https://www.youtube.com/watch?v='+v.id,thumbnail:v.snippet.thumbnails?.medium?.url,views:Number(v.statistics.viewCount||0),style:['reset','science','coffee','learn'][i%4],duration:'Review clip duration',hook:'Review this foreign-source English video and its Creative Commons license.',script:'Source review checklist:\nCheck that the actual content originates from the declared foreign country.\nConfirm the exact video license and whether it covers every included visual and audio element.\nRecord attribution and permission scope for your selected platforms.\nObtain the video through an authorized download supplied by the creator.\nUpload only the finished MP4 you have rights to publish.'}));
 return {mode:'live',message:'English videos with a Creative Commons label and a creator-declared country matching your selection. Ordered by candidate view count, not a real-time global trend ranking. Verify content origin and license before reuse.',items,fetchedAt:new Date().toISOString()};
 }catch{return {mode:'error',message:'Live discovery is unavailable. Check the API key and quota. These fallback concepts are not verified foreign-source content.',items:starterIdeas};}
}
