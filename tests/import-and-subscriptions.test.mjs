import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const source = fs.readFileSync(new URL('../src/programImport.ts', import.meta.url), 'utf8');
function makeFakeDb(initial = {}) {
  const docs = new Map(Object.entries(initial));
  const mock = {
    doc: (_db, ...path) => ({path: path.join('/')}),
    collection: (_db, ...path) => ({path: path.join('/')}),
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    getDocs: async ref => ({docs: Array.from(docs.entries()).filter(([path]) => {
      if (!path.startsWith(ref.path + '/')) return false;
      return !path.slice(ref.path.length + 1).includes('/');
    }).map(([path, data]) => ({id: path.split('/').at(-1), data: () => data}))}),
    writeBatch: () => {
      const changes = [];
      return {set(ref, data) {changes.push([ref.path, data, false]);},
        update(ref, data) {changes.push([ref.path, data, true]);},
        async commit(){for (const [path, data, patch] of changes) docs.set(path, patch ? {...docs.get(path), ...data} : data);}};
    },
  };
  const js = ts.transpileModule(source, {fileName:'programImport.ts', compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  vm.runInNewContext(js, {exports,require:(id) => {assert.equal(id, 'firebase/firestore');return mock;}});
  return {docs, api:exports};
}
const sample = {programs:[{id:'portage',name:'بورتاج — التدخل المبكر',domains:[{
  id:'portage-d01',name:'التنشئة الاجتماعية',goals:[{id:'g1',text:'صياغة قديمة'},{id:'g2',text:'هدف ثان'}]
}]}]};

test('import reuses manual Portage and preserves edited goals on retry', async()=>{
  const {docs,api}=makeFakeDb({
    'programs/manually-added': {name:'بورتاج (Portage)'},
    'programs/manually-added/domains/random-domain': {name:'التنشئة الاجتماعية'},
    'programs/manually-added/domains/random-domain/goals/g1': {text:'هدف تم تعديله من الإدارة', approved:true}
  });
  const result=await api.importProgramBundle({},sample,()=>{});
  assert.equal(result.programsDone,1);
  assert.equal(result.goalsAdded,1);
  assert.equal(result.goalsExisting,1);
  assert.equal(docs.has('programs/portage'),false);
  assert.equal(docs.get('programs/manually-added/domains/random-domain/goals/g1').text,'هدف تم تعديله من الإدارة');
  const goal2=docs.get('programs/manually-added/domains/random-domain/goals/g2');
  assert.equal(goal2.approved,false);
  assert.equal(goal2.needsReview,true);
  const second=await api.importProgramBundle({},sample,()=>{});
  assert.equal(second.goalsAdded,0);
  assert.equal(second.goalsExisting,2);
});

test('reviewed second import approves previously pending goals but retains text',async()=>{
  const {docs,api}=makeFakeDb();
  await api.importProgramBundle({},sample,()=>{});
  const key='programs/portage/domains/portage-d01/goals/g1';
  docs.set(key,{...docs.get(key),text:'تصحيح من الإدارة'});
  await api.importProgramBundle({},sample,()=>{},true);
  assert.equal(docs.get(key).approved,true);
  assert.equal(docs.get(key).text,'تصحيح من الإدارة');
});

test('publishing requires explicit review flag',async()=>{
  const {docs,api}=makeFakeDb();
  await api.importProgramBundle({},sample,()=>{},true);
  const entry=docs.get('programs/portage/domains/portage-d01/goals/g1');
  assert.equal(entry.approved,true);
  assert.equal(entry.needsReview,false);
});

test('bundle validator rejects duplicate goal IDs',async()=>{
  const {api}=makeFakeDb();
  const bad={programs:[{id:'portage',name:'P',domains:[{id:'d',name:'D',goals:[{id:'g',text:'hi'},{id:'g',text:'two'}]}]}]};
  await assert.rejects(api.readProgramBundle({size:300,text:async()=>JSON.stringify(bad)}),/مكرر/);
});

test('admin subscription and renewal workflow present and governed by rules',()=>{
  const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  const rules=fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');
  for(const needle of ['inMemoryPersistence','createSubscriber','requestRenewal','fulfillRenewal',"subscriberStatus(u,now)",'importProgramBundle']) {
    assert.match(app,new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.match(rules,/match \/renewalRequests\/\{uid\}/);
  assert.match(rules,/request\.resource\.data\.role == 'specialist'/);
  assert.match(rules,/isAdmin\(\) && request\.resource\.data\.state == 'active'/);
});
