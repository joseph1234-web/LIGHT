import kjv from './translations/kjv.json';
import bsb from './translations/bsb.json';
export type BibleVersion='web'|'kjv'|'bsb';
export const bibleVersions=[
 {id:'web' as const,name:'World English Bible Classic',short:'WEB',rights:'Public domain',url:'https://ebible.org/eng-web/',licenseUrl:'https://ebible.org/eng-web/copyright.htm'},
 {id:'kjv' as const,name:'King James Version',short:'KJV',rights:'Public domain outside the UK; UK print rights apply',url:'https://ebible.org/eng-kjv/',licenseUrl:'https://ebible.org/find/details.php?id=eng-kjv'},
 {id:'bsb' as const,name:'Berean Standard Bible',short:'BSB',rights:'Public domain',url:'https://berean.bible/',licenseUrl:'https://berean.bible/terms.htm'},
];
export function bibleVersionInfo(id?:string){return bibleVersions.find(v=>v.id===id)||bibleVersions[0];}
// Faithful quotations from the public-domain World English Bible Classic.
// Source links identify the exact chapter; verse numbers are retained in references.
export type ChurchVerse={id:string;reference:string;text:string;source:string;translation?:BibleVersion};
const v=(id:string,reference:string,text:string,chapter:string):ChurchVerse=>({id,reference,text,source:'https://ebible.org/eng-web/'+chapter+'.htm'});
export const verses:ChurchVerse[]=[
 v('ps23-1','Psalm 23:1','Yahweh is my shepherd; I shall lack nothing.','PSA023'),
 v('php4-13','Philippians 4:13','I can do all things through Christ who strengthens me.','PHP04'),
 v('1th5-17','1 Thessalonians 5:17','Pray without ceasing.','1TH05'),
 v('ps46-1','Psalm 46:1','God is our refuge and strength, a very present help in trouble.','PSA046'),
 v('rom12-12','Romans 12:12','rejoicing in hope, enduring in troubles, continuing steadfastly in prayer,','ROM12'),
 v('php4-4','Philippians 4:4','Rejoice in the Lord always! Again I will say, “Rejoice!”','PHP04'),
 v('ps100-5','Psalm 100:5','For Yahweh is good. His loving kindness endures forever, his faithfulness to all generations.','PSA100'),
 v('jhn14-27','John 14:27','Peace I leave with you. My peace I give to you; not as the world gives, I give to you. Don’t let your heart be troubled, neither let it be fearful.','JHN14'),
 v('1th5-18','1 Thessalonians 5:18','In everything give thanks, for this is the will of God in Christ Jesus toward you.','1TH05'),
 v('1co13-13','1 Corinthians 13:13','But now faith, hope, and love remain—these three. The greatest of these is love.','1CO13'),
 v('ps23-2','Psalm 23:2','He makes me lie down in green pastures. He leads me beside still waters.','PSA023'),
 v('rom12-21','Romans 12:21','Don’t be overcome by evil, but overcome evil with good.','ROM12'),
 v('php4-6','Philippians 4:6','In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God.','PHP04'),
 v('1th5-16','1 Thessalonians 5:16','Always rejoice.','1TH05'),
 v('ps100-2','Psalm 100:2','Serve Yahweh with gladness. Come before his presence with singing.','PSA100'),
 v('jhn14-18','John 14:18','I will not leave you orphans. I will come to you.','JHN14'),
 v('ps23-3','Psalm 23:3','He restores my soul. He guides me in the paths of righteousness for his name’s sake.','PSA023'),
 v('rom12-15','Romans 12:15','Rejoice with those who rejoice. Weep with those who weep.','ROM12'),
 v('php4-7','Philippians 4:7','And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus.','PHP04'),
 v('1th5-24','1 Thessalonians 5:24','He who calls you is faithful, who will also do it.','1TH05'),
 v('ps100-4','Psalm 100:4','Enter into his gates with thanksgiving, and into his courts with praise. Give thanks to him, and bless his name.','PSA100'),
 v('rom12-18','Romans 12:18','If it is possible, as much as it is up to you, be at peace with all men.','ROM12'),
 v('jhn14-15','John 14:15','If you love me, keep my commandments.','JHN14'),
 v('1co13-4','1 Corinthians 13:4','Love is patient and is kind. Love doesn’t envy. Love doesn’t brag, is not proud,','1CO13'),
 v('ps46-10','Psalm 46:10','“Be still, and know that I am God. I will be exalted among the nations. I will be exalted on the earth.”','PSA046'),
 v('php4-19','Philippians 4:19','My God will supply every need of yours according to his riches in glory in Christ Jesus.','PHP04'),
 v('1th5-11','1 Thessalonians 5:11','Therefore exhort one another, and build each other up, even as you also do.','1TH05'),
 v('ps100-1','Psalm 100:1','Shout for joy to Yahweh, all you lands!','PSA100'),
 v('rom12-9','Romans 12:9','Let love be without hypocrisy. Abhor that which is evil. Cling to that which is good.','ROM12'),
 v('ps23-4','Psalm 23:4','Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.','PSA023'),
 v('1th5-21','1 Thessalonians 5:21','Test all things, and hold firmly that which is good.','1TH05'),
 v('jhn3-16','John 3:16','For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.','JHN03'),
 v('rom12-10','Romans 12:10','In love of the brothers be tenderly affectionate to one another; in honor prefer one another,','ROM12'),
 v('ps100-3','Psalm 100:3','Know that Yahweh, he is God. It is he who has made us, and we are his. We are his people, and the sheep of his pasture.','PSA100'),
 v('luk2-10','Luke 2:10','The angel said to them, “Don’t be afraid, for behold, I bring you good news of great joy which will be to all the people.','LUK02'),
 v('luk2-11','Luke 2:11','For there is born to you today, in David’s city, a Savior, who is Christ the Lord.','LUK02'),
 v('luk2-14','Luke 2:14','“Glory to God in the highest, on earth peace, good will toward men.”','LUK02'),
 v('isa9-2','Isaiah 9:2','The people who walked in darkness have seen a great light. The light has shined on those who lived in the land of the shadow of death.','ISA09'),
 v('isa9-6','Isaiah 9:6','For a child is born to us. A son is given to us; and the government will be on his shoulders. His name will be called Wonderful Counselor, Mighty God, Everlasting Father, Prince of Peace.','ISA09'),
];
export const christmasVerses=['luk2-10','luk2-11','luk2-14','isa9-2','isa9-6','jhn3-16'];
export function getVerse(id:string,translation:BibleVersion='web'):ChurchVerse{
 const base=verses.find(v=>v.id===id)||verses[0];if(translation==='web')return base;
 if(translation!=='kjv'&&translation!=='bsb')throw new Error('Choose an available Bible version.');
 const bank:Record<string,{text:string;source:string}>=translation==='kjv'?kjv:bsb,entry=bank[base.id];
 if(!entry?.text)throw new Error('This verse is unavailable in the selected Bible version.');
 return {...base,...entry,translation};
}
/** Remove the generated translation suffix while retaining the verse and reference. */
export function captionWithoutBibleVersion(caption:string,reference:string){
 if(!reference)return caption;const escaped=reference.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return caption.replace(new RegExp('('+escaped+')\\s*\\((?:World English Bible(?: Classic)?|King James Version|Berean Standard Bible|WEB|KJV|BSB)\\)','g'),'$1');
}
