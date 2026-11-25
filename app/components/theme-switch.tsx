'use client';

import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {useTheme} from 'next-themes';

export default function ThemeSwitch() {
 const {resolvedTheme,setTheme}=useTheme();
 const [mounted,setMounted]=useState(false);
 useEffect(()=>setMounted(true),[]);

 return <div className="theme-switch" role="group" aria-label="Color theme">
  <button type="button" aria-label="Use light theme" aria-pressed={mounted&&resolvedTheme==='light'} title="Use light theme" onClick={()=>setTheme('light')}><Sun size={16}/><span>Light</span></button>
  <button type="button" aria-label="Use dark theme" aria-pressed={mounted&&resolvedTheme==='dark'} title="Use dark theme" onClick={()=>setTheme('dark')}><Moon size={16}/><span>Dark</span></button>
 </div>;
}
