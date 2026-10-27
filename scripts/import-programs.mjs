import fs from 'node:fs';
const file=process.argv[2];
if(!file||!fs.existsSync(file)){console.error('Usage: npm run import:programs -- /absolute/path/spark-programs-PRIVATE.json [--execute]');process.exit(1);}
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const names=data.programs.map(p=>`${p.id}: ${p.domains.reduce((s,d)=>s+d.goals.length,0)} items`);
console.log('Programs to import, all pending clinical and legal review:\n'+names.join('\n'));
if(!process.argv.includes('--execute')){console.log('Dry run only. Pass --execute to import.');process.exit(0);}
const {initializeApp,applicationDefault}=await import('firebase-admin/app');
const {getFirestore,FieldValue}=await import('firebase-admin/firestore');
initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID||'speak-d6e7f'});
const db=getFirestore();let writes=0, batch=db.batch(),size=0;
async function put(ref,payload){batch.set(ref,payload,{merge:true});size++;writes++;if(size>=350){await batch.commit();batch=db.batch();size=0;process.stdout.write('.');}}
for(const p of data.programs){
 await put(db.doc(`programs/${p.id}`),{name:p.name,source:p.source||'',updatedAt:FieldValue.serverTimestamp()});
 for(let i=0;i<p.domains.length;i++){
  const d=p.domains[i];await put(db.doc(`programs/${p.id}/domains/${d.id}`),{name:d.name,order:i,updatedAt:FieldValue.serverTimestamp()});
  for(let j=0;j<d.goals.length;j++){
   const g=d.goals[j];await put(db.doc(`programs/${p.id}/domains/${d.id}/goals/${g.id}`),{
    text:g.text,code:g.code||'',order:j,approved:false,needsReview:true,source:p.source||'',updatedAt:FieldValue.serverTimestamp()});
  }
 }
}
if(size)await batch.commit();console.log('\nImported '+writes+' Firestore documents. Goals require administrator review and approval.');
