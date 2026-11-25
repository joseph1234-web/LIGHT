import atlasData from './font-atlas.json';
import {imageTextMetadata,type ChurchSpec} from './model';
type Glyph={w:number;h:number;x:number;y:number;a:number;r:string};
type Face='sans'|'serif'|'bold';
const atlas=atlasData as Record<Face,Record<string,Glyph>>;
const BASE=144,W=1080,H=1350;
const masks=new Map<string,Uint8Array>();
function glyphMask(face:Face,char:string,g:Glyph){const key=face+char;let d=masks.get(key);if(d)return d;const raw=Uint8Array.from(atob(g.r),c=>c.charCodeAt(0));d=new Uint8Array(g.w*g.h);let at=0;for(let i=0;i<raw.length;i+=2){d.fill(raw[i+1],at,at+raw[i]);at+=raw[i];}masks.set(key,d);return d;}
const clean=(s:string)=>s.normalize('NFC').replace(/[^\x20-\x7E\u00a0-\u00ff‘’“”—–…•\n]/g,'?');
function width(s:string,size:number,face:Face){return Array.from(clean(s)).reduce((a,c)=>a+(atlas[face][c]||atlas[face]['?']).a,0)*size/BASE;}
export function wrapText(s:string,size:number,face:Face,max:number){const lines:string[]=[];let line='';for(const word of clean(s).split(/\s+/)){const candidate=line?line+' '+word:word;if(width(candidate,size,face)>max&&line){lines.push(line);line=word;}else line=candidate;}if(line)lines.push(line);return lines;}
function parseHex(h:string){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
class Poster{
 pixels=new Uint8Array(W*H*3);
 constructor(top:string,bottom:string){const a=parseHex(top),b=parseHex(bottom);for(let y=0;y<H;y++){const p=y/H;const row=a.map((v,i)=>Math.round(v*(1-p)+b[i]*p));for(let x=0;x<W;x++){const at=(y*W+x)*3;this.pixels[at]=row[0];this.pixels[at+1]=row[1];this.pixels[at+2]=row[2];}}}
 pixel(x:number,y:number,color:number[],alpha=1){x=Math.round(x);y=Math.round(y);if(x<0||x>=W||y<0||y>=H)return;const i=(y*W+x)*3;for(let c=0;c<3;c++)this.pixels[i+c]=Math.round(this.pixels[i+c]*(1-alpha)+color[c]*alpha);}
 rect(x:number,y:number,w:number,h:number,color:string,alpha=1){const c=parseHex(color);for(let yy=Math.max(0,Math.floor(y));yy<Math.min(H,y+h);yy++)for(let xx=Math.max(0,Math.floor(x));xx<Math.min(W,x+w);xx++)this.pixel(xx,yy,c,alpha);}
 circle(cx:number,cy:number,r:number,color:string,alpha=1){const c=parseHex(color);for(let y=Math.max(0,Math.floor(cy-r-1));y<Math.min(H,cy+r+1);y++)for(let x=Math.max(0,Math.floor(cx-r-1));x<Math.min(W,cx+r+1);x++){const distance=Math.hypot(x-cx,y-cy);if(distance<r+1)this.pixel(x,y,c,alpha*Math.min(1,r+1-distance));}}
 line(x:number,y:number,xx:number,yy:number,color:string,thickness=1,alpha=1){const steps=Math.ceil(Math.hypot(xx-x,yy-y));for(let n=0;n<=steps;n++){const p=n/Math.max(1,steps);this.circle(x+(xx-x)*p,y+(yy-y)*p,thickness/2,color,alpha);}}
 text(s:string,x:number,y:number,size:number,face:Face,color:string,align:'left'|'center'='left'){s=clean(s);const c=parseHex(color),scale=size/BASE;if(align==='center')x-=width(s,size,face)/2;for(const char of Array.from(s)){const g=atlas[face][char]||atlas[face]['?'],mask=glyphMask(face,char,g);const dw=Math.max(1,Math.round(g.w*scale)),dh=Math.max(1,Math.round(g.h*scale));for(let yy=0;yy<dh;yy++)for(let xx=0;xx<dw;xx++){const alpha=mask[Math.min(g.h-1,Math.floor(yy/scale))*g.w+Math.min(g.w-1,Math.floor(xx/scale))]/255;if(alpha)this.pixel(x+g.x*scale+xx,y+g.y*scale+yy,c,alpha);}x+=g.a*scale;}}
 block(s:string,x:number,y:number,size:number,face:Face,color:string,maxWidth:number,maxHeight:number,align:'center'|'left'='center'){let lines=wrapText(s,size,face,maxWidth);while((lines.length*size*1.38>maxHeight||lines.some(l=>width(l,size,face)>maxWidth))&&size>10){size-=1;lines=wrapText(s,size,face,maxWidth);}for(let i=0;i<lines.length;i++)this.text(lines[i],x,y+i*size*1.38,size,face,color,align);return lines.length*size*1.38;}
 star(x:number,y:number,size:number,color:string){this.line(x-size,y,x+size,y,color,2,.6);this.line(x,y-size,x,y+size,color,2,.6);this.circle(x,y,3,color,.7);}
}
const crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c;}
function crc(bytes:Uint8Array){let c=0xffffffff;for(const v of bytes)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(name:string,data:Uint8Array){const out=new Uint8Array(data.length+12),view=new DataView(out.buffer);view.setUint32(0,data.length);out.set(new TextEncoder().encode(name),4);out.set(data,8);view.setUint32(data.length+8,crc(out.subarray(4,data.length+8)));return out;}
async function encode(pixels:Uint8Array){const scan=new Uint8Array((W*3+1)*H);for(let y=0;y<H;y++)scan.set(pixels.subarray(y*W*3,(y+1)*W*3),y*(W*3+1)+1);const compressed=new Uint8Array(await new Response(new Blob([scan]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());const hdr=new Uint8Array(13),v=new DataView(hdr.buffer);v.setUint32(0,W);v.setUint32(4,H);hdr[8]=8;hdr[9]=2;const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())];const out=new Uint8Array(parts.reduce((a,p)=>a+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
export async function renderChurchImage(spec:ChurchSpec,customPixels?:Uint8Array):Promise<Uint8Array>{
 const image=imageTextMetadata(spec);
 const dark=spec.theme!=='dawn',evergreen=spec.theme==='evergreen';const top=evergreen?'#173e37':dark?'#24233f':'#f7f0e2',bottom=evergreen?'#0e2929':dark?'#3b3456':'#e9efdf';const ink=dark?'#f8f0df':'#35483b',muted=dark?'#c5bfae':'#7f8c72',gold=dark?'#d2b778':'#b49767';const p=new Poster(top,bottom);
 if(spec.template&&customPixels){
 const t=spec.template;p.pixels.set(customPixels);const x=Math.round(t.x/100*W),y=Math.round(t.y/100*H),w=Math.round(t.width/100*W),h=Math.round(t.height/100*H),center=x+w/2;const pad=26;p.rect(x,y,w,h,t.panelColor,t.panelOpacity);let at=y+pad;const usable=w-pad*2,footer=t.showBrand&&image.brand?98:60;
 if(t.showHeading&&image.heading){at+=p.block(image.heading,center,at,t.fontSize*.92,'bold',t.textColor,usable,h*.19)+18;}
 if(spec.countdown!==null){const s=spec.kind==='christmas'?`${spec.countdown} ${image.countdownText}`:spec.countdown===0?'TODAY':`${spec.countdown} ${spec.countdown===1?'DAY':'DAYS'} TO GO`;at+=p.block(s,center,at,t.fontSize*1.12,'bold',t.textColor,usable,h*.18)+18;}
 if(spec.kind==='service')at+=p.block([image.dateLabel,...spec.details,spec.message||''].filter(Boolean).join(' • '),center,at,t.fontSize*.62,'sans',t.textColor,usable,h*.23)+18;
 const available=Math.max(65,y+h-footer-at);p.block(spec.verse.text,center,at,t.fontSize,t.font,t.textColor,usable,available);p.text(spec.verse.reference+(image.translation?' · '+image.translationCode:''),center,y+h-footer+12,Math.min(25,t.fontSize*.55),'sans',t.textColor,'center');
 if(t.showBrand&&image.brand)p.block(image.brand,center,y+h-45,17,'sans',t.textColor,usable,35);return encode(p.pixels);
 }
 p.rect(45,45,W-90,1,gold,.35);p.rect(45,H-46,W-90,1,gold,.35);p.rect(45,45,1,H-90,gold,.35);p.rect(W-46,45,1,H-90,gold,.35);
 if(spec.kind==='daily'){
 p.circle(800,170,208,gold,.07);p.circle(800,170,145,gold,.05);for(let i=0;i<14;i++){const angle=i*.17;const x=1040-i*9,y=1260-i*13;p.line(x,y,x-60-Math.sin(angle)*30,y-22,gold,2,.3);p.circle(x-53,y-20,16,gold,.08);p.line(x,y,x+30,y-55,gold,2,.3);}p.line(100,230,193,230,gold,2);
 p.block(spec.verse.text,100,555,spec.verse.text.length>130?48:59,'serif',ink,850,460,'left');p.text(spec.verse.reference.toUpperCase(),100,1070,24,'bold',gold);
 }else if(spec.kind==='service'){
 p.circle(960,124,350,gold,.04);p.rect(520,90,40,125,gold,.8);p.rect(484,128,112,15,gold,.8);p.block(image.dateLabel,W/2,251,25,'sans',gold,860,80);p.block(image.brand,W/2,365,58,'bold',ink,860,150);p.line(470,600,610,600,gold,2);p.block(spec.details[0]||'',W/2,640,30,'sans',ink,860,90);p.text(spec.details[1]||'',W/2,720,54,'serif',gold,'center');p.block(spec.details[2]||'',W/2,810,27,'sans',muted,850,100);p.block(spec.verse.text,W/2,970,32,'serif',ink,800,145);p.text(spec.verse.reference,W/2,1139,19,'sans',gold,'center');p.block(spec.message||'',W/2,1180,23,'sans',ink,850,100);
 }else{
 for(let i=0;i<30;i++){const x=70+(i*137)%940,y=80+(i*73)%225;p.circle(x,y,2+(i%4),gold,.12);if(i%5===0&&(x<350||x>730))p.star(x,y,13,gold);}if(spec.kind==='event')p.text('COUNTING DOWN TO',W/2,120,22,'sans',gold,'center');p.block(spec.heading,W/2,228,spec.heading.length>25?48:64,'serif',ink,860,170);
 if(spec.countdown===0&&spec.kind==='event'){p.block('TODAY IS THE DAY',W/2,480,62,'bold',gold,850,160);}else{p.text(String(spec.countdown??''),W/2,423,216,'serif',gold,'center');p.text(spec.kind==='christmas'?image.countdownText.toUpperCase():spec.countdown===1?'DAY TO GO':'DAYS TO GO',W/2,700,25,'sans',ink,'center');}
 p.line(460,790,620,790,gold,2);p.block(spec.verse.text,W/2,847,40,'serif',ink,835,285);p.text(spec.verse.reference+(image.translation?' · '+image.translationCode:''),W/2,1152,20,'sans',gold,'center');
 }
 if(image.brand&&spec.kind!=='service')p.block(image.brand.toUpperCase(),W/2,1233,18,'sans',muted,890,59);return encode(p.pixels);
}
