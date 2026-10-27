import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('subscription enforced in security rules',()=>{
 const r=read('firestore.rules');assert.match(r,/subscriptionExpiresAt\s*>\s*request\.time/);
 assert.match(r,/request\.resource\.data\.role\s*==\s*'specialist'/);
 assert.doesNotMatch(r,/allow (read|write).*if true/);
});
test('admin tools require privileged credentials and explicit --execute',()=>{
 for(const s of ['scripts/bootstrap-admin.mjs','scripts/import-programs.mjs']){
  assert.match(read(s),/applicationDefault/);assert.match(read(s),/--execute/);
 }
});
test('per-domain assessment responses and plan export present',()=>{
 const app=read('src/App.tsx');assert.match(app,/assessments',active\.id,'responses',selectedDomain/);
 assert.match(app,/not_mastered/);assert.match(app,/saveWord/);assert.match(app,/window\.print/);
});
test('private data not placed under public directory',()=>{
 assert(!fs.existsSync(new URL('../public/spark-programs-PRIVATE.json',import.meta.url)));
 assert.match(read('.gitignore'),/private-import\/\*\.json/);
});

test('saving individual answers does not overwrite other goals',()=>{
 const code=read('src/App.tsx');
 assert.match(code,/values:\s*\{\[goal\.id\]:status\}/);
 assert.doesNotMatch(code,/values:next,updatedAt/);
});
test('sign-up profile cannot be overwritten by auth listener',()=>{
 const code=read('src/App.tsx');
 assert.match(code,/setProfileMissing\(true\)/);
 assert.doesNotMatch(code,/name:user\.email\?\.split/);
});
test('plan is saved with its assessment id, not child name',()=>{
 const code=read('src/App.tsx');
 assert.match(code,/setPlanAssessmentId\(a\.id\)/);
 assert.match(code,/doc\(db,'plans',planAssessmentId\)/);
});
test('Firebase web config has a Vercel-compatible fallback',()=>{
 const code=read('src/firebase.ts');
 assert.match(code,/import\.meta\.env\.VITE_FIREBASE_API_KEY\s*\|\|\s*defaults\.apiKey/);
 assert.match(code,/speak-d6e7f/);
});
