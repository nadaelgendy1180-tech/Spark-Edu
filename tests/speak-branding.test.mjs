import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('SPEAK branding present on app, login, PWA, export and site title',()=>{
 for(const p of ['src/App.tsx','src/export.ts','src/InstallAppButton.tsx','index.html','public/manifest.webmanifest']){
  assert.match(read(p),/SPEAK/,p);
  assert.doesNotMatch(read(p),/Spark Edu|SPARK EDU|SparkEdu/,p);
 }
});
test('founder photograph displayed with attribution on desktop and mobile',()=>{
 const app=read('src/App.tsx'),css=read('src/styles.css');
 assert.match(app,/فكرة وإعداد/);assert.match(app,/دكتورة ندا الجندي/);
 assert.match(app,/FounderCard variant="auth"/);assert.match(app,/FounderCard variant="hero"/);
 assert.match(app,/mobile-center-photo/);assert.match(css,/object-position:50% 20%/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('WhatsApp and sign out remain present',()=>{
 const app=read('src/App.tsx');
 assert.match(app,/201096585287/);assert.match(app,/https:\/\/wa\.me/);
 assert.match(app,/await signOut\(auth\)/);assert.match(app,/تسجيل الخروج/);
});
test('PWA rebranded and stale caches evicted',()=>{
 const m=JSON.parse(read('public/manifest.webmanifest'));
 assert.equal(m.short_name,'SPEAK');assert.equal(m.display,'standalone');
 assert.match(read('public/sw.js'),/speak-shell-v2/);
 assert.match(read('public/sw.js'),/spark-edu-shell-/);
 assert.match(read('src/main.tsx'),/registerSpeakPWA/);
});
