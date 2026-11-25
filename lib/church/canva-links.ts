export const canvaLinks = [
 {id:'canva-design-1',name:'Canva design 1 · Sunday service',url:'https://canva.link/tk9ynhybblrl8yv'},
 {id:'canva-design-2',name:'Canva design 2 · Bible verses',url:'https://canva.link/q1es6bhu1oj6ky5'},
 {id:'canva-design-3',name:'Canva design 3 · Christmas countdown',url:'https://canva.link/vpzm272flt9nc4y'},
] as const;

export const defaultCanvaSources={daily:canvaLinks[1].url,service:canvaLinks[0].url,christmas:canvaLinks[2].url};
export function isCanvaLink(value:unknown):value is string{if(typeof value!=='string')return false;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='canva.link'||u.hostname==='www.canva.com'||u.hostname==='canva.com')&&value.length<=1500;}catch{return false;}}
