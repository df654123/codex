const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const D=JSON.parse(fs.readFileSync('curriculum-data.js','utf8').split(' = ')[1].trim().replace(/;$/,''));
const ctx={window:{ENGLISH_CURRICULUM:D}};vm.createContext(ctx);
if(fs.existsSync('spelling-policy.js'))vm.runInContext(fs.readFileSync('spelling-policy.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('word-study-core.js','utf8'),ctx);
const W=ctx.window.WordStudyCore,u=D.units[0],s=W.normalize({});
const checks=[['be ready to do sth','be ready to do sth.',true],['favorite','favourite',true],['practise','practice',false],['practise','practise',true],['ready','already',false],["its","it's",false]];
for(const [input,target,correct] of checks)assert.equal(W.checkSpelling(s,W.createCard('7a-u1',0),input,target).correct,correct);
assert.equal(u.vocabulary[W.filterWords(s,u)[0]].word,'greet');
for(let i=0;i<8;i++)assert.equal(W.key('7a-u1',i),'7a-u1::'+i);
const C=require('../curriculum-core.js'),state=C.normalize({});
function attempt(i){return {id:'a'+i,key:C.quizKey(u.id,'vocabulary','set'+i),unitId:u.id,kind:'vocabulary',variant:'set'+i,at:'2026-11-08T00:00:00Z',answers:[0,0,0,0,0],total:5,correct:0,contentRevision:u.vocabularyRevision}}
state.attempts=[attempt(1),attempt(2)];assert.equal(C.progress(state,u).complete.vocabulary,false);assert.equal(C.nextActivity(state,u).variant,'set3');
state.attempts=Array.from({length:9},(_,i)=>attempt(i+1));assert.equal(C.progress(state,u).complete.vocabulary,true);
state.attempts.forEach(a=>a.contentRevision=1);assert.equal(C.progress(state,u).complete.vocabulary,false);
const M=require('../review-core.js'),m=M.createState(),catalog=M.catalog(D);M.addWords(m,[catalog[0]],'2026-11-08T00:00:00Z');
const old=m.cards[catalog[0].id];old.meaning='OLD';const sched=JSON.stringify(old.schedulers);M.syncCatalog(m,catalog);
assert.equal(m.cards[catalog[0].id].meaning,catalog[0].meaning);assert.equal(JSON.stringify(m.cards[catalog[0].id].schedulers),sched);
console.log('PASS 6 spelling cases; stable legacy IDs; textbook display order; all-group and revision gates; metadata repair preserves schedules.');
