import {spawnSync} from 'node:child_process';
const oracle=spawnSync(process.execPath,['tests/integration.mjs'],{stdio:'inherit',env:{...process.env,EKKLO_SQL_TRANSCRIPT:'.sites-runtime/sql-transcript.json'}});if(oracle.status!==0)process.exit(oracle.status||1);
for(const script of ['tests/postgres-replay.mjs','tests/backend-integration.mjs','tests/migration-integration.mjs']){const result=spawnSync(process.execPath,[script],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
