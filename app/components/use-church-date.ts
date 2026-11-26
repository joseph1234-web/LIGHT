'use client';
import {useEffect,useState} from 'react';
import {dateInZone} from '../../lib/church/model';
export function useChurchDate(timezone:string){
 const [date,setDate]=useState(()=>dateInZone(new Date(),timezone));
 useEffect(()=>{const update=()=>setDate(dateInZone(new Date(),timezone));update();const timer=setInterval(update,15000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update);};},[timezone]);return date;
}
