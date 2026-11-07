import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('renewal requests follow owner-id schema and admin list permissions',()=>{
  const rules=read('firestore.rules');
  const app=read('src/App.tsx');
  assert.match(rules,/match \/renewalRequests\/\{uid\}/);
  assert.match(rules,/allow list: if isAdmin\(\)/);
  assert.match(rules,/request\.resource\.data\.uid == uid/);
  assert.match(app,/doc\(db,'renewalRequests',user\.uid\)/);
  assert.match(app,/onSnapshot\(collection\(db,'renewalRequests'\)/);
  assert.doesNotMatch(rules,/allow\s+read,\s*write:\s*if\s+true/);
});
test('PWA manifest and icon paths are valid',()=>{
  const m=JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(m.display,'standalone');
  assert.ok(m.icons.length>=2);
  for(const i of m.icons)assert.ok(fs.existsSync(new URL('../public'+i.src,import.meta.url)));
  assert.match(read('index.html'),/manifest\.webmanifest/);
  assert.match(read('src/main.tsx'),/registerSpeakPWA\(\)/);
});
test('Center imagery present and page responsive',()=>{
  assert.match(read('src/App.tsx'),/center-logo\.jpeg/);
  assert.match(read('src/App.tsx'),/center-photo\.jpeg/);
  const css=read('src/styles.css');
  assert.match(css,/@media\s*\(max-width:760px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
