import {verses,getVerse,type ChurchVerse,type BibleVersion} from './verses';

export const DAILY_INSPIRATION_VERSION=2;
export const monthlyThemes=[
 {month:'January',title:'Fresh hope and new beginnings',featured:['ps23-3','1th5-24','php4-13','jhn3-16'],message:'Good morning! Begin this day with hope. Take one faithful step, and welcome the good you can do today.'},
 {month:'February',title:'Love in everyday actions',featured:['1co13-4','1co13-13','rom12-15','1th5-11','jhn3-16'],message:'Good morning! Start with kindness. A patient word, a thoughtful message, or a small act of love can brighten someone’s day.'},
 {month:'March',title:'Courage for the journey',featured:['ps46-1','php4-13','ps23-4','1th5-24'],message:'Good morning! Meet today with courage. You can take the next step without needing to see the whole journey.'},
 {month:'April',title:'Renewal and living hope',featured:['jhn3-16','ps23-3','jhn14-18','php4-7'],message:'Good morning! Make room for renewal. Let today be an opportunity to grow, begin again, and share hope.'},
 {month:'May',title:'Strength and gentle guidance',featured:['php4-13','ps23-1','ps23-3','php4-19','1th5-11'],message:'Good morning! Start with a willing heart. Ask for guidance, do what you can, and encourage someone along the way.'},
 {month:'June',title:'Peace for a busy day',featured:['jhn14-27','php4-6','php4-7','ps46-10','ps23-2','rom12-18'],message:'Good morning! Pause, breathe, and begin in prayer. Carry peace into your work, your conversations, and your next decision.'},
 {month:'July',title:'Faithfulness in small steps',featured:['1th5-24','ps100-5','ps23-1','jhn14-15','php4-19'],message:'Good morning! Small faithful actions matter. Show up with hope, keep doing good, and notice the blessings along the way.'},
 {month:'August',title:'Growth and perseverance',featured:['1th5-21','ps23-3','php4-13','rom12-21','1th5-11'],message:'Good morning! Give yourself room to learn and grow. Choose what is good and keep moving forward with patience.'},
 {month:'September',title:'Hope through changing seasons',featured:['1th5-24','jhn14-27','ps46-1','ps23-4','php4-7'],message:'Good morning! A changing season can bring a fresh opportunity. Begin with trust, and be a source of encouragement today.'},
 {month:'October',title:'Faith over fear',featured:['ps23-4','ps46-1','jhn14-27','php4-13','ps46-10'],message:'Good morning! Let faith guide your first step. Face today’s responsibilities with a calm heart and a spirit of courage.'},
 {month:'November',title:'Gratitude and thanksgiving',featured:['ps100-4','1th5-18','ps100-5','php4-4','1th5-16','ps100-2'],message:'Good morning! Begin with a thankful heart. Notice God’s goodness, appreciate the people around you, and share a little kindness today.'},
 {month:'December',title:'Christmas hope, joy, and peace',featured:['luk2-10','luk2-11','luk2-14','isa9-2','isa9-6','jhn3-16'],message:'Good morning! Carry the hope of Christ into this Christmas season. Make room for peace, give with love, and bring joy to someone today.'},
];
export function monthlyTheme(date:string){return monthlyThemes[Number(date.slice(5,7))-1]||monthlyThemes[0];}
export function monthlyVerseIds(date:string){
 const featured=monthlyTheme(date).featured;
 // Interleave a monthly focus with encouragement, without repeating a verse in a month.
 const general=verses.slice(0,34).map(v=>v.id).filter(id=>!['rom12-12','rom12-10'].includes(id)&&!featured.includes(id));
 const order:string[]=[];let a=0,b=0;
 while(a<featured.length||b<general.length){if(a<featured.length)order.push(featured[a++]);for(let n=0;n<2&&b<general.length;n++)order.push(general[b++]);}
 return order;
}
export function morningVerse(date:string,version:BibleVersion='web'){const ids=monthlyVerseIds(date);return getVerse(ids[(Number(date.slice(8,10))-1)%ids.length],version);}
export function captionWithoutMonthlyTheme(caption:string){
 for(const theme of monthlyThemes)caption=caption.replace(theme.month+' · '+theme.title+'\n','');
 return caption;
}
export function morningCaption(churchName:string,date:string,verse:ChurchVerse){
 const theme=monthlyTheme(date),label=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(date+'T00:00:00Z'));
 return `BIBLE VERSE OF THE DAY\n${label}\n\n${verse.text}\n— ${verse.reference}\n\n${theme.message}\n\n${churchName?churchName+'\n':''}#BibleVerseOfTheDay #MorningEncouragement #Faith`;
}
