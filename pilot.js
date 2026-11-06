(() => {
'use strict';
const root=document.getElementById('weekPilotRoot'), packs=new Map((window.WEEK_ONE_PACKS||[]).map(p=>[p.id.toLowerCase(),p]));
if(!root||!packs.size)return;
const key='englishWeekPilotV1', base='7a-u1', title=['','先试三个词','隔日再拼','读一段，找依据','把词用在自己身上','写给一个人','让读者读得更明白','一周后再回想'];
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])), norm=t=>t.normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
const day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10), ordinal=s=>Math.floor(Date.parse(s+'T00:00:00Z')/86400000), plus=(s,n)=>new Date((ordinal(s)+n)*86400000).toISOString().slice(0,10);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x), own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k), txt=(v,len)=>typeof v==='string'&&v.length<=len;
const dateOK=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(ordinal(s))&&plus(s,0)===s;
const fail=()=>{throw new Error('第一周试学记录格式不正确，未导入。');};
function validate(v){
  if(!obj(v)||v.version!==1||!packs.has(v.selected)||!obj(v.units)||Object.keys(v.units).length>8)fail();
  for(const [id,u] of Object.entries(v.units)){
    if(!packs.has(id)||!obj(u)||!dateOK(u.start)||!obj(u.attempts)||!obj(u.tasks)||!obj(u.drafts))fail();
    for(const [n,a] of Object.entries(u.attempts))if(!['1','2','7'].includes(n)||!obj(a)||!dateOK(a.date)||!Array.isArray(a.answers)||a.answers.length!==3||!a.answers.every(s=>txt(s,80)))fail();
    for(const [n,a] of Object.entries(u.tasks))if(!['3','4','5','6'].includes(n)||!obj(a)||!dateOK(a.date)||!txt(a.text,1200)||!txt(a.extra,800))fail();
    for(const [n,a] of Object.entries(u.drafts))if(!['1','2','3','4','5','6','7'].includes(n)||!obj(a)||!['text','extra','w0','w1','w2'].every(k=>!own(a,k)||txt(a[k],k==='text'?1200:k==='extra'?800:80))||Object.keys(a).some(k=>!['text','extra','w0','w1','w2'].includes(k)))fail();
  }return v;
}
function curriculumUnit(){try{const id=JSON.parse(localStorage.getItem('englishCurriculumStateV30')||'{}').selectedUnit;return packs.has(id)?id:base;}catch(_){return base;}}
function initial(){return {version:1,selected:curriculumUnit(),units:{}}}
let store=initial(), warn='', badLoad=false,chosen=false;
try{const raw=localStorage.getItem(key);if(raw){store=validate(JSON.parse(raw));chosen=true;}}catch(_){badLoad=true;warn='原有试学记录未能读取。为保护原记录，本页暂不覆盖它；可先在家长中心核对备份。';}
function save(){if(badLoad)return;try{localStorage.setItem(key,JSON.stringify(store));warn='';}catch(_){warn='浏览器未允许保存，当前作答暂留在本页。请先通过全站「备份记录」导出，再关闭页面。';}}
const id=()=>store.selected, unit=()=>store.units[id()], pack=()=>packs.get(id()), fresh=()=>({start:day(),attempts:{},tasks:{},drafts:{}});
let step=0, showingSummary=false;
function result(a,p){return a.answers.reduce((s,t,i)=>s+(norm(t)===norm(p.words[i].en)?1:0),0);}
function lock(n,u){
 if(![2,7].includes(n))return '';
 if(!u.attempts[1])return '先完成第1天的首次拼写，才能比较后来还记得什么。';
 if(n===2&&u.attempts[7]&&!u.attempts[2])return '本单元已完成末次回忆，隔日记录留空，不补记为隔日成绩。';
 const first=u.attempts[1].date;
 let due=plus(first,n===2?1:6);
 if(n===7&&u.attempts[2]&&u.attempts[2].date>=due)due=plus(u.attempts[2].date,1);
 return day()<due?'最早 '+due+'（北京时间）再来独立作答。今天可以做阅读或表达；同一天重复拼写不会计为跨日结果。':'';
}
function suggested(u){
 if(!u||!u.attempts[1])return 1;
 const gap=ordinal(day())-ordinal(u.attempts[1].date), target=Math.max(1,Math.min(7,gap+1));
 if(!u.attempts[7]&&target===7&&!lock(7,u))return 7;
 if(!u.attempts[2]&&!lock(2,u))return 2;
 for(const n of [3,4,5,6])if(n<=target&&!u.tasks[n])return n;
 return target;
}
function notice(){return '<div id="wp-persist" role="status" class="wp-note"'+(warn?'':' hidden')+'>'+esc(warn)+'</div>';}
function showSave(){let n=document.getElementById('wp-persist');if(n){n.hidden=!warn;n.textContent=warn;}}
function formInput(label,name,value,limit=1200){return '<label class="wp-field" for="wp-'+name+'">'+esc(label)+'</label><textarea id="wp-'+name+'" name="'+name+'" maxlength="'+limit+'" rows="3" required>'+esc(value)+'</textarea>';}
function header(){let p=pack();return '<div class="wp-card wp-head"><div class="wp-kicker">七年级上册 · 七天试学</div><h2>这周学的词，过几天还能用吗？</h2><p>选学校正在学的单元。每天建议 8–12 分钟，围绕三个词，留下自己的拼写、阅读依据和一段改过的英文。</p><label class="wp-field" for="wp-unit">教材单元</label><select id="wp-unit">'+[...packs].map(([k,v],i)=>'<option value="'+k+'"'+(k===id()?' selected':'')+'>Unit '+(i+1)+' · '+esc(v.title)+'</option>').join('')+'</select><p class="wp-small">'+esc(p.topic)+'。本页为单元主题原创配套，不代替课本逐页学习。换单元会保留已做记录。</p></div>';}
function summary(u,p){
 let body='<p>本周记录保存在当前浏览器，可随全站「备份记录」一起导出。独立拼写只反映这三个词；阅读和表达由人结合原文看。</p>';
 if(u){let rows=[[1,'首次拼写'],[2,'跨日拼写'],[7,'一周回忆']];
 body+='<div class="wp-grid">'+rows.map(([n,t])=>'<div><small>'+t+'</small><b>'+(u.attempts[n]?result(u.attempts[n],p)+' / 3':'未测')+'</b>'+(u.attempts[n]?'<small>'+esc(u.attempts[n].date)+'</small>':'')+'</div>').join('')+'</div>';
 const latest=u.attempts[7]||u.attempts[2];if(latest){const missed=p.words.filter((w,i)=>norm(latest.answers[i])!==norm(w.en)).map(w=>w.en);body+='<p><b>下一步：</b>'+esc(missed.length?'把 '+missed.join('、')+' 放回新的句子，明天再独立拼一次。':'这次三个词都拼对了。请孩子换个场景，用其中一个词说一句话。')+'</p>';}else body+='<p><b>下一步：</b>还没有跨日证据，先别判断是否掌握。</p>';
 for(const [n,label] of [[3,'阅读判断和依据'],[4,'自己的例句'],[5,'写给读者的初稿'],[6,'修改后的版本']]){const a=u.tasks[n];body+='<details><summary>'+label+' · '+(a?'有作品':'尚未提交')+'</summary>'+(a?'<p class="wp-work">'+esc(a.text)+'</p>'+(a.extra?'<p class="wp-work">'+esc(a.extra)+'</p>':''):'<p>完成相应活动后再来查看。</p>')+'</details>';}
 body+='<p class="wp-small">亲子共读：请孩子指出原文中支持判断的一处细节，或说说修改后读者多知道了什么。页面不自动给开放表达打分。</p>';}
 return '<details id="wp-summary" class="wp-card"'+(showingSummary?' open':'')+'><summary>家长看这一周：成绩与作品</summary>'+body+'</details>';
}
function quiz(n,u,p){
 const a=u.attempts[n];if(a)return '<h3>本次独立拼写：'+result(a,p)+' / 3</h3><p class="wp-small">'+esc(a.date)+' · 保留当天首次提交。</p>'+p.words.map((w,i)=>'<div class="wp-result"><b>'+esc(w.en)+'</b> · '+esc(w.zh)+'<br>你的作答：'+esc(a.answers[i]||'（空白）')+' · '+(norm(a.answers[i])===norm(w.en)?'正确':'再学一次')+'<br><span lang="en">'+esc(w.example)+'</span></div>').join('')+'<p>合上答案，用自己的话说说其中一个词。当天可以再练，但这次成绩不变。</p>';
 let why=lock(n,u);if(why)return '<p id="wp-locked" class="wp-note">'+esc(why)+'</p>';
 const draft=u.drafts[n]||{}, order=n===1?[0,1,2]:n===2?[1,2,0]:[2,0,1];
 return '<p>不看课本和提示答案，补全下面三句中的单词。不会的可以留空；系统忽略大小写和首尾空格，按提示的词形核对。</p><form id="wp-form" autocomplete="off">'+order.map((i,j)=>'<label class="wp-field" for="wp-w'+i+'">'+(j+1)+'. '+esc(p.words[i].clue)+'</label><input type="text" id="wp-w'+i+'" name="w'+i+'" maxlength="80" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" lang="en" value="'+esc(draft['w'+i]||'')+'">').join('')+'<label class="wp-small" style="display:block;margin:13px 0"><input type="checkbox" id="wp-empty"> 三个都暂时不会，仍要留下首次记录</label><div role="status" id="wp-msg"></div><button type="submit" class="wp-primary" id="wp-submit">提交首次作答，查看答案</button></form>';
}
function exercise(n,u,p){
 const a=u.tasks[n],d=u.drafts[n]||{};let intro='',l1='',l2='',model='';
 if(n===3){intro='<p class="wp-reading" lang="en">'+esc(p.read)+'</p><p>'+esc(p.question)+'</p>';l1='我的判断（中文或英文均可）';l2='从文中摘出帮助我判断的英文词句';model=p.answer;}
 if(n===4){intro='<p>选一个词写一件你自己的事，给同桌看。写清一个具体的人、时间或地点。</p><p><b>'+p.words.map(w=>esc(w.en)).join(' · ')+'</b></p>';l1='我的英文句子';model=p.words[0].example;}
 if(n===5){intro='<p>'+esc(p.task)+'</p>';l1='我的英文初稿';model=p.sample;}
 if(n===6){if(!u.tasks[5])return '<p class="wp-note">先给读者写一份初稿。留下原稿后，才能看见修改前后的不同。</p><button type="button" data-wp-step="5">去写初稿</button>';
 intro='<p>把初稿读给自己或家人听。对方最可能在哪里问“谁、何时、哪里或为什么”？补充或换掉一句，保留你的原意。</p><p class="wp-work">'+esc(u.tasks[5].text)+'</p>';l1='修改后的英文';l2='我改了哪里？读者现在多知道了什么？';model='和初稿对照：你改的地方能回答读者的哪个问题？有条件时，请真实读者说说他读懂了什么。';}
 if(a)return intro+'<p class="wp-small">'+esc(a.date)+' · 已保留你的作答</p><div class="wp-work">'+esc(a.text)+'</div>'+(a.extra?'<p class="wp-work">'+esc(a.extra)+'</p>':'')+'<details><summary>'+(n===6?'再想一步':'对照参考，看看有什么不同')+'</summary><p>'+esc(model)+'</p></details>';
 return intro+'<form id="wp-form">'+formInput(l1,'text',d.text||'')+(l2?formInput(l2,'extra',d.extra||'',800):'')+'<div id="wp-msg" role="status"></div><div class="wp-actions"><button type="submit" class="wp-primary" id="wp-submit">保存我的作答</button></div><p class="wp-small">输入时会在本机保留草稿，提交后保留这一版作品。</p></form>';
}
function render(){
 if(!chosen&&!Object.keys(store.units).length)store.selected=curriculumUnit();
 const u=unit(),p=pack();if(u&&!step)step=suggested(u);if(!u)step=0;
 let html=header()+notice();
 if(!u)html+='<section class="wp-card"><h3>今天从这里开始</h3><p>先独立拼三个词，提交后才看答案。下次从这个单元接着学。</p><button id="wp-start" class="wp-primary" type="button">开始本单元试学</button></section>';
 else{
 html+='<section class="wp-card"><p class="wp-kicker">我的七天安排</p><nav class="wp-days" aria-label="选择试学活动">'+title.slice(1).map((t,i)=>{let k=i+1;return '<button type="button" data-wp-step="'+k+'" aria-label="第'+k+'天：'+t+'"'+(k===step?' aria-current="step"':'')+'>第'+k+'天'+(u.attempts[k]||u.tasks[k]?' ✓':'')+'</button>';}).join('')+'</nav><p class="wp-small">开始于 '+esc(u.start)+'。错过一天也可接着学；第2天和第7天按实际日期开放。</p></section>';
 html+='<section id="wp-activity" class="wp-card"><div class="wp-kicker">第 '+step+' 天</div><h3>'+title[step]+'</h3>'+([1,2,7].includes(step)?quiz(step,u,p):exercise(step,u,p))+'</section>';
 }
 html+=summary(u,p)+'<div class="wp-actions"><button type="button" id="wp-course">打开这个单元的同步课堂</button></div>';root.innerHTML=html;
}
root.addEventListener('toggle',e=>{if(e.target.id==='wp-summary')showingSummary=e.target.open;},true);
root.addEventListener('change',e=>{if(e.target.id==='wp-unit'&&packs.has(e.target.value)){chosen=true;store.selected=e.target.value;step=0;showingSummary=false;save();render();}});
root.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='wp-start'){chosen=true;if(!unit())store.units[id()]=fresh();step=1;save();render();}
 else if(b.dataset.wpStep){const k=Number(b.dataset.wpStep);if(k>=1&&k<=7){step=k;showingSummary=false;render();document.getElementById('wp-activity')?.scrollIntoView({block:'start',behavior:'instant'});}}
 else if(b.id==='wp-course')window.Curriculum?.selectUnit(id(),'course');
});
root.addEventListener('input',e=>{const u=unit(),el=e.target;if(!u||!el.closest('#wp-form')||!['text','extra','w0','w1','w2'].includes(el.name))return;(u.drafts[step]||(u.drafts[step]={}))[el.name]=el.value;save();showSave();});
root.addEventListener('submit',e=>{
 if(e.target.id!=='wp-form')return;e.preventDefault();const u=unit(),f=e.target,p=pack();if(!u)return;const msg=s=>{document.getElementById('wp-msg').textContent=s;};
 if([1,2,7].includes(step)){if(u.attempts[step]||lock(step,u))return;const a=p.words.map((_,i)=>f.elements['w'+i].value.trim());if(!a.some(Boolean)&&!document.getElementById('wp-empty').checked){msg('请先写下能想起的词；确实都不会时，可勾选上面的选项。');return;}u.attempts[step]={date:day(),answers:a};}
 else{if(u.tasks[step])return;const t=f.elements.text.value.trim(),x=f.elements.extra?.value.trim()||'';if(!t||(f.elements.extra&&!x)){msg('请先写下你的作答再保存。');return;}if(step===6&&norm(t)===norm(u.tasks[5].text)){msg('请在初稿上作一处实际修改，再保存这一版。');return;}u.tasks[step]={date:day(),text:t,extra:x};}
 delete u.drafts[step];save();render();document.getElementById('wp-activity')?.scrollIntoView({block:'start',behavior:'instant'});
});
window.addEventListener('storage',e=>{if(e.key!==key||!e.newValue)return;try{store=validate(JSON.parse(e.newValue));chosen=true;step=0;render();}catch(_){}});
window.WeekPilot={snapshot:()=>JSON.parse(JSON.stringify(store)),validate,render,showSummary:()=>{showingSummary=true;render();document.getElementById('wp-summary')?.scrollIntoView({block:'start',behavior:'instant'});}};
render();
})();
