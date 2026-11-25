import manifest from './christmas-pack-manifest.json';
export const christmasPack=manifest;
export function christmasPackImage(date:string){
 const stamp=Date.parse(date+'T00:00:00Z'),christmas=Date.parse(date.slice(0,4)+'-12-25T00:00:00Z'),days=Math.round((christmas-stamp)/86400000);
 const file=(manifest.days as Record<string,number>)[String(days)],printedYear=(manifest.explicitYears as Record<string,number>)[String(days)],wrongYear=!!printedYear&&printedYear!==Number(date.slice(0,4)),asset=file&&!wrongYear?manifest.files.find(a=>a.file===file+'.png'):null;
 const reason=wrongYear?`The supplied ${days}-day image shows ${printedYear}. Supply a matching image for ${date.slice(0,4)}.`:(manifest.heldDays as Record<string,string>)[String(days)]||(days<0||days>50?'This date is outside the uploaded pack’s 50-day countdown.':`The uploaded ZIP has no verified image showing ${days} ${days===1?'day':'days'} remaining.`);
 return {packId:manifest.id,daysRemaining:days,available:!!asset,file:asset?.file||null,path:asset?manifest.assetRoot+'/'+asset.file:null,sha256:asset?.sha256||null,reason:asset?'':reason};
}
