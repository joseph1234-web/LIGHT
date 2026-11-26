'use client';
import {christmasPackImage} from '../../lib/church/christmas-pack';
import {Gift,CheckCircle2} from 'lucide-react';
export default function ChristmasPackPanel({date,selected,disabled,onSelect}:{date:string;selected:boolean;disabled:boolean;onSelect:()=>void}){
 const image=christmasPackImage(date);
 return <section className="panel christmas-pack-panel"><div><h2><Gift size={20}/>Christmas image pack</h2><p>Ready-made images for the 50-day countdown.</p><button className="btn secondary" disabled={disabled||selected} onClick={onSelect}><CheckCircle2 size={15}/>{selected?'Selected':'Use image pack'}</button></div><div className="christmas-pack-preview">{image.available?<img src={image.path!} alt={`${image.daysRemaining} days until Christmas`}/>:<p>{image.reason}</p>}</div></section>;
}
