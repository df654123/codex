(function(){
  'use strict';
  const C=window.ClassicsCore,D=window.ENGLISH_CLASSICS;
  if(!C||!D||!D.books?.length)return;
  const $=id=>document.getElementById(id),esc=escapeHtml;
  const storageKey='englishClassicsStateV31';
  const books=new Map(D.books.map(b=>[b.id,b]));
  let state,query='';
  try{state=C.normalize(JSON.parse(safeStore.get(storageKey,'{}')));}catch{state=C.normalize({});}
  if(!books.has(state.selectedBook))state.selectedBook=D.books[0].id;
  const currentBook=()=>books.get(state.selectedBook);
  const currentSection=()=>currentBook().sections.find(s=>s.id===state.sections[currentBook().id])||currentBook().sections[0];
  const currentKey=()=>C.key(currentBook().id,currentSection().id);
  const gradeLabel=g=>({7:'七年级',8:'八年级',9:'九年级'})[g];
  const button=(label,action,value='',css='outline-btn')=>`<button type="button" class="${css}" data-classic-action="${action}" data-value="${esc(value)}">${esc(label)}</button>`;
  const paragraph=text=>text.split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');
  const wordCount=text=>(text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)||[]).length;
  const save=()=>window.restoringSnapshot?false:safeStore.set(storageKey,JSON.stringify(state));
  function focusSection(){ $('clSection').scrollIntoView({block:'start',behavior:'instant'});$('clSectionTitle').focus({preventScroll:true}); }
  function render(){
    $('classicsRoot').innerHTML=`<div class="cl-heading"><div><span class="cx-kicker">LIANYUNGANG READING LIST</span><h2>连云港英语阅读书目</h2><p>从一个故事出发，慢慢读完一本书。</p></div><span class="cl-badge">2026 市级推荐 · 第一学期</span></div>
      <details class="cl-source"><summary>书目依据与读本说明</summary><p>书名与年级来自连云港市中小学“真阅读工程”2026 年修订推荐书目，政府官网发布于 2026 年 6 月 15 日。公开节录列出七、八、九年级第一学期各 5 本；第二学期英语书目未在该节录中展示。</p><p>市级书目未指定出版社、ISBN 或改编版本。本站英文书名用于作品识别，导读和题目由本站编写；请配合学校选用的正版读本阅读。原著资源中的文字难度与章节可能不同。</p><a href="${esc(D.source.url)}" target="_blank" rel="noopener noreferrer">查看市政府官网书目</a></details>
      <div class="cl-controls"><div class="cl-filters" aria-label="筛选阅读年级">${['7','8','9','all'].map(g=>`<button type="button" data-classic-action="grade" data-value="${g}" aria-pressed="${state.filterGrade===g}">${g==='all'?'全部书目':gradeLabel(g)}</button>`).join('')}</div><label class="cl-search">搜索书名<input id="clSearch" type="search" placeholder="中文、英文书名或作者" value="${esc(query)}"></label></div>
      <p class="cl-count" id="clShelfCount" aria-live="polite"></p><div class="cl-shelf" id="clShelf"></div><div class="cl-reader" id="clReader"></div>`;
    renderShelf();renderBook();renderGrowth();
    if($('classics').classList.contains('active'))document.querySelector('#aiPanel small').textContent=currentBook().title+' · 阅读提示';
  }
  function renderShelf(){
    const q=query.trim().toLowerCase();
    const matches=D.books.filter(b=>(state.filterGrade==='all'||String(b.grade)===state.filterGrade)&&(!q||[b.title,b.englishTitle,b.author,...b.themes].join(' ').toLowerCase().includes(q)));
    $('clShelfCount').textContent=`当前 ${matches.length} 本 · 全书架 ${D.books.length} 本 · 导读练习和笔记按书保存`;
    $('clShelf').innerHTML=matches.length?matches.map(b=>{const p=C.progress(state,b);return `<button type="button" class="cl-book" data-classic-action="book" data-value="${b.id}" aria-pressed="${b.id===state.selectedBook}"><small>${gradeLabel(b.grade)} · ${esc(b.term)}${b.id==='wind-in-the-willows'?' · 六次分段导读':''}</small><strong>${esc(b.title)}</strong><span lang="en">${esc(b.englishTitle)}</span><em>${p.done}/${p.total} 次导读练习已完成</em></button>`;}).join(''):`<div class="empty-state"><p>没有找到这本书。可以换个关键词，或查看全部书目。</p>${button('清除筛选','clear')}</div>`;
  }
  function renderBook(){
    const b=currentBook(),s=currentSection(),p=C.progress(state,b);
    $('clReader').innerHTML=`<div class="cl-book-heading"><span class="cx-kicker">${gradeLabel(b.grade)} · ${esc(b.term)} · ${p.done}/${p.total} 次导读练习</span><h2 id="clBookTitle" tabindex="-1">${esc(b.title)}</h2><p class="cl-english-title" lang="en">${esc(b.englishTitle)}</p><p class="cl-credit">${esc(b.author)}</p><p>${esc(b.intro)}</p><div class="cl-themes">${b.themes.map(t=>`<span>${esc(t)}</span>`).join('')}</div><p class="cl-credit">${esc(b.guideNote)} 导读完成情况不等同于读完整本原书。</p><div class="cx-actions"><a class="outline-btn" href="${esc(b.sourceUrl)}" target="_blank" rel="noopener noreferrer">英文原著资源</a>${button('回到书架','shelf')}</div><details class="cl-characters"><summary>人物与阅读线索</summary><ul>${b.characters.map(c=>`<li><strong>${esc(c.name)}</strong>：${esc(c.description)}</li>`).join('')}</ul></details></div>
      ${b.sections.length>1?`<div class="cl-stages" aria-label="选择导读阶段">${b.sections.map((x,i)=>`<button type="button" data-classic-action="section" data-value="${x.id}" aria-pressed="${x.id===s.id}">${i+1}. ${esc(x.title)}<small>${esc(x.chapterRange)}${state.results[C.key(b.id,x.id)]?' · 已练习':''}</small></button>`).join('')}</div>`:''}<article class="cl-section" id="clSection"></article>`;
    renderSection();
  }
  function renderSection(){
    const b=currentBook(),s=currentSection(),k=currentKey(),note=state.notes[k],d=state.drafts[k];
    const i=b.sections.indexOf(s);
    $('clSection').innerHTML=`<span class="cx-kicker">${esc(s.chapterRange)} · 本站原创导读</span><h3 id="clSectionTitle" tabindex="-1">${esc(s.title)}</h3><p class="cl-credit"><span lang="en">${esc(s.englishTitle)}</span> · ${wordCount(s.reading)} 个英文词</p><div class="cx-actions">${button('朗读导读','audio')}${button('停止朗读','stop')}${button('做 5 道理解题','quiz')}</div><div class="cl-prose" lang="en">${paragraph(s.reading)}</div>
      <details class="cl-summary"><summary>读后核对：中文大意</summary><p>${esc(s.summary)}</p></details><h4 style="margin-top:24px">阅读词汇</h4><div class="cl-vocabulary">${s.vocabulary.map(w=>`<div class="cl-word"><strong lang="en">${esc(w.word)}</strong><span>${esc(w.meaning)}</span><p lang="en">${esc(w.example)}</p></div>`).join('')}</div>
      <details class="cl-question-entry" id="clQuizDetails"${d?' open':''}><summary>理解与思考 · 5 道题</summary><p class="cl-credit">题目依据上方导读作答。提交后查看解析，再回到手边的读本找更多证据。</p><div id="clQuiz"></div></details>
      <section class="cl-journal"><h4>回到书中，想深一步</h4><p>${esc(s.discussion)}</p><label for="clNote">我的读书笔记</label><p id="clNotePrompt">${esc(s.journalPrompt)}</p><textarea id="clNote" rows="6" maxlength="5000" aria-describedby="clNotePrompt clNoteStatus" placeholder="写下页码、人物的行动和你的想法，也可以用英语写几句。">${esc(note?.text||'')}</textarea><p class="cl-note-status" id="clNoteStatus" role="status">${note?'已恢复本阶段笔记 · '+note.text.length+'/5000 字符':'笔记自动保存在当前浏览器，并包含在整站备份中。'}</p></section>
      <div class="cl-next">${i>0?button('上一次导读','section',b.sections[i-1].id):button('回到书架','shelf')}${i<b.sections.length-1?button('下一次导读','section',b.sections[i+1].id,'primary-btn'):button('选择下一本书','shelf','', 'primary-btn')}</div>`;
    renderQuiz();
  }
  function renderQuiz(){
    const s=currentSection(),k=currentKey(),d=state.drafts[k]||{answers:[],submitted:false},result=state.results[k];
    $('clQuiz').innerHTML=`<form id="clQuizForm">${s.questions.map((q,i)=>`<fieldset class="quiz-question ${d.submitted?(d.answers[i]===q.correctIndex?'is-correct':'is-wrong'):''}"><legend><span class="question-index">${String(i+1).padStart(2,'0')}</span>${esc(q.prompt)}</legend><div class="quiz-options">${q.options.map((o,j)=>`<label class="quiz-option ${d.submitted&&j===q.correctIndex?'correct-option':''}"><input type="radio" name="clq${i}" value="${j}" data-classic-question="${i}"${d.answers[i]===j?' checked':''}${d.submitted?' disabled':''}><span class="option-letter">${'ABCD'[j]}</span><span>${esc(o)}</span></label>`).join('')}</div>${d.submitted?`<p class="answer-explanation"><strong>${d.answers[i]===q.correctIndex?'✓ 回答正确':'再看一看'} · 参考答案 ${'ABCD'[q.correctIndex]}</strong><br>${esc(q.explanation)}</p>`:''}</fieldset>`).join('')}<p class="cl-result" id="clQuizStatus" role="status">${d.submitted?`本次答对 ${C.score(s.questions,d.answers).correct}/5 题`:`已选择 ${d.answers.filter(Number.isInteger).length}/5 题`}${!d.submitted&&result?` · 上次答对 ${result.correct}/5 题`:''}</p>${button(d.submitted?'再练一次':'提交并查看解析',d.submitted?'retry':'submit','','primary-btn')}</form>`;
  }
  function renderGrowth(){
    const allKeys=Object.keys(state.results),noteCount=Object.values(state.notes).filter(n=>n.text.trim()).length;
    const active=D.books.filter(b=>b.sections.some(s=>state.results[C.key(b.id,s.id)]||state.notes[C.key(b.id,s.id)]?.text.trim()));
    $('clGrowth').innerHTML=`<h3>我的整本书阅读</h3><p>${allKeys.filter(k=>D.books.some(b=>b.sections.some(s=>C.key(b.id,s.id)===k))).length} 次导读练习 · ${noteCount} 篇阶段笔记。阅读进度与笔记按作品保存。</p><div class="cl-growth-links">${active.length?active.map(b=>`<button class="outline-btn" type="button" data-classic-open="${b.id}">${esc(b.title)} · ${C.progress(state,b).done}/${b.sections.length} 次导读</button>`).join(''):'<button class="outline-btn" type="button" data-classic-open="wind-in-the-willows">从《柳林风声》开始</button>'}</div>`;
  }
  function selectBook(id,scroll=true){
    if(!books.has(id))return;
    stopEverything();state.selectedBook=id;state.filterGrade=String(books.get(id).grade);query='';save();render();
    if(scroll){$('clReader').scrollIntoView({block:'start',behavior:'instant'});$('clBookTitle').focus({preventScroll:true});}
  }
  function openBook(id){openView('classics');selectBook(books.has(id)?id:state.selectedBook);}
  function selectSection(id){
    if(!currentBook().sections.some(s=>s.id===id))return;
    stopEverything();state.sections[currentBook().id]=id;save();renderBook();focusSection();
  }
  function submit(){
    const k=currentKey(),d=state.drafts[k]||{answers:[]};
    if(d.submitted)return;
    try{
      const result=C.score(currentSection().questions,d.answers),at=new Date().toISOString();
      state.results[k]={...result,answers:[...d.answers],at};
      state.drafts[k]={answers:[...d.answers],submitted:true,at};
      const ok=save();renderBook();renderShelf();renderGrowth();
      $('clQuizStatus').textContent=`本次答对 ${result.correct}/5 题 · ${ok?'已保存到这本书':'暂存当前页面，请导出备份'}`;
      $('clQuizStatus').scrollIntoView({block:'center',behavior:'instant'});
    }catch(e){$('clQuizStatus').textContent=e.message;}
  }
  const growth=document.createElement('section');growth.id='clGrowth';growth.className='cl-growth';$('learningHistory').after(growth);
  window.Classics={openBook,renderGrowth,label:()=>currentBook().title+' · 阅读提示',snapshot:()=>JSON.parse(JSON.stringify(state)),reply:()=>`正在读《${currentBook().title}》的“${currentSection().title}”。${currentSection().summary}\n思考提示：${currentSection().discussion}\n可以在本页保存自己的读书笔记。`};
  render();
  document.addEventListener('click',e=>{
    const open=e.target.closest('[data-classic-open]');if(open){openBook(open.dataset.classicOpen);return;}
    const b=e.target.closest('[data-classic-action]');if(!b)return;
    const action=b.dataset.classicAction,value=b.dataset.value;
    if(action==='book')selectBook(value);
    if(action==='section')selectSection(value);
    if(action==='grade'){state.filterGrade=value;save();render();}
    if(action==='clear'){state.filterGrade='all';query='';save();render();}
    if(action==='shelf'){$('classicsRoot').scrollIntoView({block:'start',behavior:'instant'});$('clSearch').focus({preventScroll:true});}
    if(action==='audio')speakText(currentSection().reading);
    if(action==='stop')stopEverything();
    if(action==='quiz'){$('clQuizDetails').open=true;$('clQuizDetails').scrollIntoView({block:'start',behavior:'instant'});$('clQuiz').querySelector('input:not(:disabled)')?.focus({preventScroll:true});}
    if(action==='submit')submit();
    if(action==='retry'){state.drafts[currentKey()]={answers:[],submitted:false,at:new Date().toISOString()};save();renderQuiz();$('clQuizDetails').scrollIntoView({block:'start',behavior:'instant'});}
  });
  $('classicsRoot').addEventListener('submit',e=>{e.preventDefault();submit();});
  $('classicsRoot').addEventListener('change',e=>{
    const input=e.target;if(input.dataset.classicQuestion===undefined)return;
    const k=currentKey(),old=state.drafts[k];if(old?.submitted)return;
    const answers=old?.answers?.slice()||[];answers[Number(input.dataset.classicQuestion)]=Number(input.value);
    state.drafts[k]={answers,submitted:false,at:new Date().toISOString()};
    const ok=save();$('clQuizStatus').textContent=`已选择 ${answers.filter(Number.isInteger).length}/5 题 · ${ok?'草稿已保存':'暂存当前页面，请导出备份'}`;
  });
  $('classicsRoot').addEventListener('input',e=>{
    if(e.target.id==='clSearch'){query=e.target.value;renderShelf();}
    if(e.target.id==='clNote'){
      const text=e.target.value.slice(0,5000);state.notes[currentKey()]={text,at:new Date().toISOString()};
      const ok=save();$('clNoteStatus').textContent=`${ok?'本阶段笔记已自动保存':'笔记暂存当前页面，请导出备份'} · ${text.length}/5000 字符`;renderGrowth();
    }
  });
  window.addEventListener('storage',e=>{
    if(e.key!==storageKey||window.restoringSnapshot)return;
    try{const next=C.normalize(JSON.parse(e.newValue||'{}'));if(!books.has(next.selectedBook))next.selectedBook=state.selectedBook;state=next;render();}catch{}
  });
})();
