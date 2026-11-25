export type CloudRun = {checkedAt:string;state:string;advanced?:number;published?:number};

/** Only a verified cloud invocation writes this receipt. Page polling is separate. */
export function runnerHealth(lastRun:CloudRun|undefined, configured:boolean, clock=Date.now()) {
 const age=lastRun?clock-Date.parse(lastRun.checkedAt):NaN;
 const status=!configured?'not_configured':!Number.isFinite(age)?'awaiting_check':age< -60000||age>90*60000?'stale':lastRun?.state==='error'?'error':'healthy';
 const labels={not_configured:'Cloud schedule not connected',awaiting_check:'Waiting for first cloud check',stale:'Cloud check overdue',error:'Cloud check needs attention',healthy:'Cloud runner connected'};
 return {status,label:labels[status],configured,cadenceMinutes:60,lastCheckedAt:lastRun?.checkedAt||null,lastOutcome:lastRun?.state||null,published:lastRun?.published||0};
}
