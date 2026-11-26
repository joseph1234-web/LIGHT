/** The seasonal series keeps its saved schedule while its occasion changes. */
export function countdownSeason(date:string){
 const year=Number(date.slice(0,4)),newYear=date.slice(5)==='01-01'||date.slice(5)>'12-25';
 const targetDate=newYear?(date.slice(5)==='01-01'?year:year+1)+'-01-01':year+'-12-25';
 return {occasion:newYear?'newyear' as const:'christmas' as const,title:newYear?'New Year countdown':'Christmas countdown',targetDate,year:Number(targetDate.slice(0,4)),daysRemaining:Math.round((Date.parse(targetDate+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000)};
}
