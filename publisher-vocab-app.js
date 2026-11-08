/* Namespaced publisher pilot. No accounts, network uploads, or Yilin ID rewriting. */
(()=>{'use strict';
const root=document.getElementById('publisherVocabRoot'),D=window.PUBLISHER_VOCAB_DATA,P=window.SpellingPolicy;
if(!root||!D||!P)return;
const KEY='englishPublisherVocabV1',allowed=new Set(D.entries.map(w=>w.id));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function validate(v){
 if(!plain(v)||v.schemaVersion!==1||!Array.isArray(v.events)||v.events.length>5000||Object.keys(v).some(k=>!['schemaVersion','events'].includes(k)))throw Error('教材试学备份格式不正确。');
 const seen=new Set();
 for(const e of v.events){
  if(!plain(e)||Object.keys(e).sort().join(',')!=='at,correct,id,input,kind,wordId'||typeof e.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(e.id)||seen.has(e.id)||!allowed.has(e.wordId)||!['spelling','recall'].includes(e.kind)||typeof e.input!=='string'||e.input.length>160||typeof e.correct!=='boolean'||typeof e.at!=='string'||!Number.isFinite(Date.parse(e.at)))throw Error('教材试学记录无效，原记录未修改。');
  seen.add(e.id);
 }
 return JSON.parse(JSON.stringify(v));
}
const empty=()=>({schemaVersion:1,events:[]});
function merge(a,b){const map=new Map();for(const e of [...a.events,...b.events]){if(map.has(e.id)&&JSON.stringify(map.get(e.id))!==JSON.stringify(e))throw Error('记录标识冲突，请保留两份备份。');map.set(e.id,e);}return validate({schemaVersion:1,events:[...map.values()].sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id))});}
let state=empty(),blocked=false,raw='',warn='',publisher='rj',unit='rj-2024-7a-u1',cursor=0,mode='cards',revealed=false,result=null,busy=false;
try{raw=localStorage.getItem(KEY)||'';if(raw)state=validate(JSON.parse(raw));}catch{blocked=true;warn='原有教材试学记录无法读取，未覆盖原记录。新作答暂存本页，请先导出备份。';}
const current=()=>D.entries[cursor];
const saved=()=>{try{const s=localStorage.getItem(KEY);return s?validate(JSON.parse(s)):empty();}catch{throw Error('浏览器记录不可读，本页内容尚未永久保存。');}};
async function write(event){
 if(busy||window.restoringSnapshot)return false;busy=true;
 const perform=()=>{if(blocked)throw Error(warn);state=merge(saved(),state);localStorage.setItem(KEY,JSON.stringify(state));};
 try{if(event)state=merge(state,{schemaVersion:1,events:[event]});if(navigator.locks?.request)await navigator.locks.request(KEY,perform);else perform();warn='';return true;}
 catch(e){warn=e.message+' 请导出本页备份后再关闭。';return false;}
 finally{busy=false;}
}
const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
function event(kind,input,correct){return {id:uid(),wordId:current().id,kind,input,correct,at:new Date().toISOString()};}
function reset(){revealed=false;result=null;}
function source(){return `<details class="pv-source"><summary>教材版本、来源与核验范围</summary><p>${esc(D.edition)}。${esc(D.sourceNote)}</p><p><a href="${esc(D.officialUrl)}" target="_blank" rel="noopener noreferrer">人教社官方配套目录（需联网）</a> · <a href="${esc(D.referenceUrl)}" target="_blank" rel="noopener noreferrer">教材文本参照副本（第三方，需联网）</a></p><p>学习记录只保存在本浏览器；不上传，暂不跨设备自动同步。</p></details>`;}
function render(){
 let content='';
 if(publisher==='yl')content=`<h3>译林版 · 七年级上册</h3><p>Unit 1：参照新词表40项＋课内复现5项；Unit 2：参照新词表47项＋站内拓展8项。其余单元仍待逐词核验。</p><p>参照印次为2024年首版、2025年第二次印刷；不声称2026新版已完整核验。</p><div class="pv-actions"><button data-pv="yl1">进入 Unit 1</button><button data-pv="yl2">进入 Unit 2</button></div>`;
 else{
 content=`<h3>人教版 · 七年级上册</h3><p><strong>${esc(D.status)}</strong>。这是独立教材入口，不会改变译林版的学习记录。</p><label for="pv-unit">选择单元</label><select id="pv-unit">${D.units.map(u=>`<option value="${u.id}"${u.id===unit?' selected':''}>${esc(u.title)}</option>`).join('')}</select>${source()}`;
 if(unit!=='rj-2024-7a-u1')content+='<p class="pv-notice">此单元目前仅核对了官方目录，词汇尚未接入。没有生成或冒充完整教材内容。</p>';
 else{
 const w=current(),attempts=state.events.filter(e=>e.kind==='spelling'),right=attempts.filter(e=>e.correct).length;
 content+=`<div class="pv-actions"><button data-pv="cards" aria-pressed="${mode==='cards'}">回想词义</button><button data-pv="spelling" aria-pressed="${mode==='spelling'}">练习拼写</button></div><p>本组 ${cursor+1} / ${D.entries.length} · 拼写记录 ${right} / ${attempts.length} 次正确（不是掌握词数）</p><article class="pv-card"><small>参照词表成员 · 正文首次出现 p.${w.page} · 例句原创</small><h4 lang="${mode==='cards'?'en':'zh-CN'}">${esc(mode==='cards'?w.word:w.meaning)}</h4>`;
 if(mode==='spelling')content+=`<form id="pv-form"><label for="pv-input">写出本题词条（不是任意同义表达）</label><input id="pv-input" maxlength="160" autocomplete="off" autocapitalize="none" spellcheck="false" lang="en"${result?' disabled':''}><button type="submit"${result?' disabled':''}>检查第一次拼写</button></form>`;
 if(revealed||result)content+=`<p><b lang="en">${esc(w.word)}</b> · ${esc(w.pos)} ${esc(w.meaning)}</p><p lang="en">${esc(w.example)}</p>`;
 if(result)content+=`<p role="status">${result.correct?'本次正确':'请对照本题词条再学习'}。${esc(result.note||'')} ${warn?'本次暂存页面，尚未写入浏览器。':'已保存在本浏览器。'}</p>`;
 if(mode==='cards'&&!result)content+=revealed?'<div class="pv-actions"><button data-pv="again">还没想起</button><button data-pv="remembered">自己想起了</button></div>':'<button data-pv="reveal">先回想，再揭晓</button>';
 content+='</article><div class="pv-actions"><button data-pv="prev">上一项</button><button data-pv="next">下一项</button></div><details><summary>本组词条与出处</summary><ol>'+D.entries.map(w=>`<li><span lang="en">${esc(w.word)}</span> · ${esc(w.meaning)}（p.${w.page}）</li>`).join('')+'</ol></details>';
 }
 }
 root.innerHTML=`<header><p>教材词汇中心</p><h2>按自己的教材学习</h2><p>不同出版社分别组织，词义要放回具体单元；先核验，再逐步补齐。</p></header><label for="pv-publisher">教材出版社</label><select id="pv-publisher"><option value="yl"${publisher==='yl'?' selected':''}>译林版</option><option value="rj"${publisher==='rj'?' selected':''}>人教版初中英语 · 试学</option></select><section>${content}</section><p class="pv-notice" id="pv-status" role="status">${esc(warn)}</p><footer><button data-pv="export">导出人教试学记录</button> <label for="pv-import">合并试学备份</label><input id="pv-import" type="file" accept="application/json,.json"><p>也已接入全站备份。旧备份没有本模块时，现有人教记录会保留；不清除其他模块记录。</p></footer>`;
}
function download(){const out={...state};if(blocked){window.downloadText?.('人教试学异常原记录.txt',raw,'text/plain;charset=utf-8');}window.downloadText?.('人教试学备份.json',JSON.stringify(out,null,2),'application/json');}
root.addEventListener('click',async e=>{
 const b=e.target.closest('[data-pv]');if(!b||busy)return;
 const a=b.dataset.pv;
 if(a==='yl1'||a==='yl2'){window.Curriculum.selectUnit(a==='yl1'?'7a-u1':'7a-u2','course');return;}
 if(a==='export'){download();return;}
 if(a==='cards'||a==='spelling'){mode=a;reset();}
 if(a==='prev'||a==='next'){cursor=(cursor+(a==='next'?1:D.entries.length-1))%D.entries.length;reset();}
 if(a==='reveal')revealed=true;
 if(['again','remembered'].includes(a)&&revealed&&!result){result={correct:a==='remembered',note:'这是回忆自评，不是自动测评。'};b.disabled=true;await write(event('recall','',result.correct));}
 render();
});
root.addEventListener('submit',async e=>{
 if(e.target.id!=='pv-form')return;e.preventDefault();if(result||busy)return;
 const input=e.target.querySelector('input').value.trim();if(!input)return;
 result=P.compare(input,current().word);e.target.querySelector('button').disabled=true;
 await write(event('spelling',input,result.correct));render();
});
root.addEventListener('change',async e=>{
 if(e.target.id==='pv-publisher'){publisher=e.target.value;reset();render();}
 if(e.target.id==='pv-unit'){unit=e.target.value;cursor=0;reset();render();}
 if(e.target.id==='pv-import'){
  const f=e.target.files?.[0];if(!f)return;
  try{if(f.size>2000000)throw Error('备份文件过大。');const v=validate(JSON.parse(await f.text()));if(!confirm('把 '+v.events.length+' 条人教试学记录合并到本浏览器？已有记录不会删除。'))return;state=merge(state,v);await write();render();}catch(err){warn=err.message;render();}
 }
});
window.PublisherVocab={validate,snapshot:()=>validate(state),render};render();
})();
