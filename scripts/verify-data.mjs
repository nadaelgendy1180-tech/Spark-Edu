import fs from 'node:fs';
import assert from 'node:assert/strict';
const file=process.argv[2];if(!file||!fs.existsSync(file)){console.error('Usage: npm run verify:data -- /absolute/path/spark-programs-PRIVATE.json');process.exit(1);}
const data=JSON.parse(fs.readFileSync(file,'utf8'));let total=0;
for(const program of data.programs){
 const ids=new Set();assert(program.name&&program.domains.length);
 for(const domain of program.domains){assert(domain.name);for(const goal of domain.goals){assert(goal.text?.trim()&&goal.id);assert(!ids.has(goal.id));ids.add(goal.id);total++;}}
 console.log(program.id,program.domains.length,'domains',ids.size,'goals');
}
console.log('OK:',total,'goals are parseable; contents are NOT clinically validated.');
