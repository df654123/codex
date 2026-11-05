(function () {
  'use strict';
  const C=window.EnglishCore, key='englishLearningStateV24';
  const $=id=>document.getElementById(id), esc=escapeHtml;
  let state;try{state=C.normalizeState(JSON.parse(safeStore.get(key,'{}')));}catch{state=C.normalizeState({});}
  const groups=window.ENGLISH_EXERCISES.groups, names={listening:'听力',vocabulary:'词汇',grammar:'语法',reading:'阅读',writing:'写作自查'};
  let currentExercise='', saving=false, recorder=null, mediaStream=null, recordUrl='', recordStart=0, recordingTimer=null, recordingBusy=false, pendingSpeakingRecord=null;
  const rawTasks=(()=>{try{return JSON.parse(safeStore.get('englishGrowthTasks','{}'));}catch{return {};}})();
  if(rawTasks?._date && rawTasks._date!==C.dayKey()) state.days[rawTasks._date]={...C.dayRecord(state,rawTasks._date),tasks:rawTasks,reflection:safeStore.get('englishReflection','')};
  const todayRecord=C.dayRecord(state);
  if(rawTasks?._date!==C.dayKey()){
    saved={...todayRecord.tasks,_date:C.dayKey()};
    $('reflection').value=todayRecord.reflection||'';
    safeStore.set('englishReflection',$('reflection').value);
  }

  function save(){
    if(saving||window.restoringSnapshot)return !window.learningStorageFailed;
    saving=true;const ok=safeStore.set(key,JSON.stringify(state));saving=false;
    if(ok && !window.learningStorageFailed)$('cloudStatus').textContent='学习记录已保存';
    return ok;
  }
  function saveDraft(field,value){state.drafts[field]=value;return save();}
  function captureDay(){
    if(window.restoringSnapshot)return;
    state.days[saved._date||C.dayKey()]={tasks:{...saved},reflection:$('reflection').value,mode:safeStore.get('studyMode','standard')};
    save();render();
  }
  function ensureDay(){
    if(window.restoringSnapshot)return;
    if(window.Curriculum){Curriculum.ensureDay();return;}
    const day=C.dayKey();if(saved._date===day)return;
    captureDay();
    const r=C.dayRecord(state,day);saved={...r.tasks,_date:day};
    $('reflection').value=r.reflection||'';
    safeStore.set('englishGrowthTasks',JSON.stringify(saved));safeStore.set('englishReflection',$('reflection').value);
    syncTasks();render();updateHomeDateAndGreeting();
  }
  function syncTasks(){
    taskBoxes.forEach(b=>{b.checked=!!saved[b.dataset.task];b.closest('.task').classList.toggle('completed',b.checked);});
    updateProgress();syncHomeTasks();
    const p=C.progress(saved,safeStore.get('studyMode','standard'));
    $('sidebarPercent').textContent=p.percent+'%';document.querySelector('.mini-progress span').style.width=p.percent+'%';
  }
  function setTask(task,value=true){
    ensureDay();saved[task]=value;
    safeStore.set('englishGrowthTasks',JSON.stringify(saved));syncTasks();captureDay();
  }
  function syncMode(){
    const modeName=safeStore.get('studyMode','standard'),plan=C.mode(modeName);
    document.querySelectorAll('[data-study-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.studyMode===modeName);b.setAttribute('aria-pressed',b.dataset.studyMode===modeName?'true':'false');});
    taskBoxes.forEach(b=>{const i=plan.tasks.indexOf(b.dataset.task),row=b.closest('.task');row.hidden=i<0;(row.querySelector('.task-time')||row.lastElementChild).textContent=i<0?'可选':plan.times[i]+'分钟';});
    document.querySelectorAll('.home-task').forEach(row=>{const i=plan.tasks.indexOf(row.querySelector('input').dataset.homeTask);row.hidden=i<0;row.style.display=i<0?'none':'grid';row.querySelector('em').textContent=i<0?'可选':plan.times[i]+'分钟';});
    const chips=document.querySelectorAll('#today .unit-banner .chip');chips[0].textContent='预计 '+plan.minutes+' 分钟';chips[1].textContent=modeName==='light'?'轻量计划 · 4项':'标准计划 · 5项';
    learnerProfile=learnerProfile||defaultLearnerProfile();learnerProfile.targetMinutes=plan.minutes;
    safeStore.set(LEARNER_PROFILE_KEY,JSON.stringify(learnerProfile));
    $('sessionTargetText').textContent='当前计划 '+plan.minutes+'分钟';syncTasks();captureDay();
  }
  function latestAttempt(kind){return [...state.attempts].reverse().find(a=>a.kind===kind);}
  function statsMarkup(items){return items.map(([label,value,note])=>`<div class="stat"><small>${esc(label)}</small><strong>${esc(value)}</strong>${note?`<span>${esc(note)}</span>`:''}</div>`).join('');}
  function scoreRows(scores){return Object.entries(scores).map(([kind,a])=>`<div class="score-row"><span>${names[kind]}</span><div class="score-track"><i style="width:${a?a.percent:0}%"></i></div><strong>${a?a.correct+' / '+a.total:'未练习'}</strong></div>`).join('');}
  function render(){
    if(window.restoringSnapshot)return;
    const scores=C.latestScores(state),s=C.summary(state,learningSessions()),today=C.dayKey();
    const metrics=[['连续学习',s.streak+'天','按有记录的日期计算'],['完成练习',s.attempts+'组','每组答题后保存'],['累计阅读',s.reading+'篇','按完成的不同短文计算'],['口语自查',s.speaking+'次','记录你完成的表达练习']];
    document.querySelectorAll('.home-metric').forEach((el,i)=>{el.querySelector('small').textContent=metrics[i][0];el.querySelector('strong').textContent=metrics[i][1];el.querySelector('em').textContent=metrics[i][2];});
    const cp=C.progress(saved,safeStore.get('studyMode','standard'));
    document.querySelector('.course-percent').textContent=cp.percent+'%';document.querySelector('.course-line span').style.width=cp.percent+'%';
    document.querySelector('.continue-footer>span').textContent=state.drafts.lastStudyView?'上次学习：'+(VIEW_NAMES[state.drafts.lastStudyView]||'主题课程'):'从词汇开始，慢慢完成今天的主题';
    $('homeContinue').textContent=s.days||state.drafts.lastStudyView?'继续学习':'开始学习';
    document.querySelector('.ability-card h3').textContent='本主题练习记录';document.querySelector('.ability-card .home-tag').textContent='PRACTICE RECORD';
    document.querySelector('.growth-up').textContent=s.attempts?'已完成 '+s.attempts+' 组':'从第一组开始';
    document.querySelector('.ability-list').innerHTML=scoreRows(scores);
    document.querySelector('.ability-note').textContent='展示各项最近一次独立作答。还没练习的项目会保留为空，记录不代表整体英语能力。';
    document.querySelector('.parent-glance h3').textContent=s.days?'一起回顾今天的小收获':'第一次学习，从一小步开始';
    document.querySelector('.parent-glance p').textContent=s.days?'看看完成了哪些练习，听孩子说一句今天学会的英语。':'先完成一个词汇或语法练习，再聊聊学会了什么。';
    const monday=new Date(today+'T04:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
    const activeDates=new Set(learningSessions().map(r=>C.sessionDate(r)));
    Object.entries(state.days).forEach(([d,r])=>{if(Object.values(r.tasks||{}).some(v=>v===true))activeDates.add(d);});
    state.attempts.forEach(a=>activeDates.add(C.dayKey(a.at)));
    document.querySelector('.week-map').innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setUTCDate(d.getUTCDate()+i);const k=C.dayKey(d),done=activeDates.has(k);return `<div class="week-day ${done?'done':''} ${k===today?'current':''}"><span>${['一','二','三','四','五','六','日'][i]}</span><strong>${k.slice(5).replace('-','/')}</strong><small>${done?'有记录':k===today?'今天':k>today?'待学习':'无记录'}</small></div>`;}).join('');
    $('growthStats').innerHTML=statsMarkup([['累计学习',s.days+'天'],['已保存学习时间',formatDuration(s.durationMs),'仅计开始后前台停留'],['完成基础练习',s.attempts+'组'],['最近各项答对',s.answered?s.correct+' / '+s.answered:'暂无记录']]);
    $('realScores').innerHTML=scoreRows(scores)+(state.writing.length?`<p class="mini-note">最近写作自查：${state.writing[state.writing.length - 1].checks.filter(Boolean).length} / 5 项（自查记录）</p>`:'<p class="mini-note">写作与口语采用自查，不生成自动评分。</p>');
    const mistakes=[];Object.entries(scores).forEach(([kind,a])=>{if(!a)return;const group=groups.find(g=>g.id===kind);(a.answers||[]).forEach((choice,i)=>{if(group?.questions[i]&&choice!==group.questions[i].correctIndex)mistakes.push({kind,q:group.questions[i],choice});});});
    $('realAdvice').innerHTML=mistakes.length?`<p class="quote">先复习「${esc(mistakes[0].q.skill)}」。看完解析，再独立做一次${names[mistakes[0].kind]}练习。</p><button class="outline-btn" onclick="LearningApp.openExercise('${mistakes[0].kind}')">回到这组练习</button>`:s.answered?'<p class="quote">最近已完成的独立练习中暂无错题。试着合上提示，用完整句介绍自己。</p><button class="outline-btn" onclick="openView(\'speaking\')">练习自我介绍</button>':'<p class="quote">先从 am / is / are 的5道题开始，看看哪些句子已经会用了。</p><button class="outline-btn" onclick="LearningApp.openExercise(\'grammar\')">开始语法练习</button>';
    $('mistakeList').innerHTML=mistakes.length?mistakes.map(({kind,q,choice})=>`<details class="record-item mistake"><summary><span class="record-tag">${names[kind]}</span>${esc(q.prompt)}</summary><p>你的选择：${esc(q.options[choice]||'未作答')}</p><p><strong>参考答案：${esc(q.options[q.correctIndex])}</strong></p><p>${esc(q.explanation)}</p></details>`).join(''):`<div class="empty-state">${s.answered?'最近已完成的独立练习中暂无错题。':'完成一组独立练习后，错题与解析会出现在这里。'}</div>`;
    $('learningHistory').innerHTML=learningSessions().length?learningSessions().slice(0,12).map(r=>`<article class="record-item"><div class="record-head"><strong>${esc(C.sessionDate(r))}</strong><span>${esc(formatDuration(r.durationMs))}</span></div><p>${esc(r.mood||'已完成学习')} · 任务完成 ${Number(r.taskCompletion)||0}%</p>${r.childNote?`<blockquote>${esc(r.childNote)}</blockquote>`:''}</article>`).join(''):'<div class="empty-state">点击“开始今日学习”，结束时保存自评，就会留下第一条足迹。</div>';
    const badges=[['🌱','学习第一步',s.days>0,'留下第一个学习记录'],['📖','阅读探索者',s.reading>0,'完成一篇短文的练习'],['🎙️','勇敢开口',s.speaking>0,'完成一次口语自查'],['☀️','七日小树苗',s.streak>=7,'连续7天留下学习记录']];
    $('realBadges').innerHTML=badges.map(([icon,title,done,note])=>`<div class="card badge-card ${done?'earned':'locked'}"><div class="icon-box">${icon}</div><h4>${title}</h4><p>${note}</p><small>${done?'已点亮':'待点亮'}</small></div>`).join('');
    const weekStart=C.dayKey(monday);const weekSessions=learningSessions().filter(r=>{const d=C.sessionDate(r);return d>=weekStart&&d<=today;});
    const weekDays=new Set(weekSessions.map(r=>C.sessionDate(r)));const weekTime=weekSessions.reduce((n,r)=>n+Math.max(0,Number(r.durationMs)||0),0);
    $('parentStats').innerHTML=statsMarkup([['本周保存学习',weekDays.size+'天'],['本周学习时间',formatDuration(weekTime)],['本周学习次数',weekSessions.length+'次'],['本周观察',betaData.parentLogs.filter(r=>C.dayKey(r.date)>=weekStart).length+'条']]);
    const last=learningSessions()[0];$('parentSummary').innerHTML=last?`<p><strong>${esc(C.sessionDate(last))}</strong> · ${esc(formatDuration(last.durationMs))}</p><p>孩子的感受：${esc(last.mood||'未填写')}<br>完成方式：${esc(last.independence||'未填写')}<br>最困难：${esc(last.hardestModule||'未填写')}</p>${last.childNote?`<blockquote>${esc(last.childNote)}</blockquote>`:''}`:'<p class="empty-state">还没有保存的学习会话。学生结束学习并完成自评后，这里会显示实际记录。</p>';
    $('parentLogList').innerHTML=betaData.parentLogs.length?betaData.parentLogs.slice(0,8).map(r=>`<article class="record-item"><strong>${esc(C.dayKey(r.date))}</strong><p>${esc(r.startMode)} · 家长观察投入程度 ${Number(r.engagement)||0}/5</p>${r.hardest?`<p>困难：${esc(r.hardest)}</p>`:''}${r.favorite?`<p>喜欢：${esc(r.favorite)}</p>`:''}${r.observation?`<p>${esc(r.observation)}</p>`:''}</article>`).join(''):'<p class="empty-state">记录一个今天观察到的具体变化。</p>';
    syncTasks();renderCards();
    if(window.Curriculum)Curriculum.refresh();
  }
  function renderCards(){
    const icons={listening:'🎧',vocabulary:'Aa',grammar:'be',reading:'📖',writing:'✍️'};
    $('assessmentCards').innerHTML=groups.map(g=>{const a=latestAttempt(g.id),w=state.writing[state.writing.length - 1];return `<article class="card exercise-card"><div class="exercise-card-head"><span class="exercise-icon">${icons[g.id]}</span><span class="chip">${g.type==='self_check'?'5项自查':'5道基础题'}</span></div><h3>${esc(g.title.split('：').slice(-1)[0])}</h3><p>${g.id==='writing'?'写下5—8句话，保存并逐项检查。':esc({listening:'抓住姓名、年龄、班级与兴趣。',vocabulary:'在句子里认识5个核心词。',grammar:'看清主语，再选择合适的 be 动词。',reading:'回到原文，为自己的答案找依据。'}[g.id])}</p><small class="exercise-card-result">${a?'最近答对 '+a.correct+'/'+a.total+' 题'+(a.assisted?' · 文本辅助':''):g.id==='writing'&&w?'已保存写作 · '+w.checks.filter(Boolean).length+'/5 项自查':'等待你的第一次尝试'}</small><button class="outline-btn" type="button" data-exercise="${g.id}">${state.quizDrafts[g.id]&&!state.quizDrafts[g.id].submitted?'继续练习':g.id==='writing'?'开始写作':'开始练习'}</button></article>`;}).join('')+'<article class="card exercise-card report-card"><div class="exercise-icon">↗</div><h3>我的学习记录</h3><p>答案、错题和学习感受，都从真实练习中留下。</p><button class="outline-btn" onclick="openView(\'growth\')">查看学习记录</button></article>';
  }
  function openExercise(id){
    if(window.Curriculum){Curriculum.openExercise(id);return;}
    const g=groups.find(x=>x.id===id);if(!g)return;
    openView('assessment');currentExercise=id;
    if(!state.quizDrafts[id])state.quizDrafts[id]={id:uid('practice'),answers:[],assisted:false,submitted:false,checks:[]};
    renderExercise();$('exerciseWorkspace').scrollIntoView({behavior:'smooth',block:'start'});$('exerciseTitle').focus({preventScroll:true});
  }
  function renderExercise(){
    const g=groups.find(x=>x.id===currentExercise),d=state.quizDrafts[currentExercise],root=$('exerciseWorkspace');if(!g||!d)return;
    root.hidden=false;
    let material='';
    if(g.audio)material=`<div class="exercise-material"><div class="audio-material-actions"><button type="button" class="primary-btn" data-listen>播放对话</button><button type="button" class="outline-btn" data-transcript>${d.showTranscript?'收起听力文本':'查看听力文本'}</button></div><p class="mini-note">使用设备英语朗读。${d.assisted?'已查看文本，本次按文本辅助练习记录。':'可以重播；查看文本后会标记为辅助练习。'}</p>${d.showTranscript?`<div class="transcript">${esc(g.audio.transcript).replace(/\n/g,'<br>')}</div>`:''}</div>`;
    if(g.passage)material=`<details class="exercise-material" open><summary>${esc(g.passageTitle)}</summary><p class="english-passage">${esc(g.passage)}</p></details>`;
    const heading=`<div class="exercise-header"><div><span class="home-tag">${g.type==='self_check'?'WRITE & REFLECT':'YOUR TURN'}</span><h3 id="exerciseTitle" tabindex="-1">${esc(g.title)}</h3></div><button type="button" class="quiet-btn" data-close-exercise>收起练习</button></div><p>${esc(g.instructions)}</p>`;
    if(g.type==='self_check'){
      root.innerHTML=heading+`<label class="writing-label" for="writingDraft">我的自我介绍 <span>输入后自动保存草稿</span></label><textarea id="writingDraft" class="writing-area" rows="8" maxlength="4000" placeholder="${esc(g.inputPlaceholder)}">${esc(state.drafts.writing||'')}</textarea><div class="writing-counter" id="writingCounter"></div><div class="writing-checklist">${g.checklist.map((q,i)=>`<label><input type="checkbox" data-writing-check="${i}" ${d.checks?.[i]?'checked':''}><span><strong>${esc(q.label)}</strong><small>${esc(q.help)}</small></span></label>`).join('')}</div><details class="model-answer"><summary>查看参考表达</summary><p class="english-passage">${esc(g.modelText).replace(/\n/g,'<br>')}</p></details><button class="primary-btn" type="button" data-save-writing>保存写作与自查</button><p id="writingSaveStatus" role="status"></p>`;
      writingCount();return;
    }
    root.innerHTML=heading+material+`<form id="quizForm">${g.questions.map((q,i)=>`<fieldset class="quiz-question ${d.submitted?(d.answers[i]===q.correctIndex?'is-correct':'is-wrong'):''}"><legend><span class="question-index">${String(i+1).padStart(2,'0')}</span>${esc(q.prompt)}</legend><div class="quiz-options">${q.options.map((o,j)=>`<label class="quiz-option ${d.submitted&&j===q.correctIndex?'correct-option':''}"><input type="radio" name="q${i}" value="${j}" data-question="${i}" ${d.answers[i]===j?'checked':''} ${d.submitted?'disabled':''}><span class="option-letter">${'ABCD'[j]}</span><span>${esc(o)}</span></label>`).join('')}</div>${d.submitted?`<p class="answer-explanation"><strong>${d.answers[i]===q.correctIndex?'✓ 回答正确':'再看一看'} · 参考答案 ${'ABCD'[q.correctIndex]}</strong><br>${esc(q.explanation)}</p>`:''}</fieldset>`).join('')}<div class="quiz-bottom"><p id="quizStatus" role="status">${d.submitted?`本次答对 ${d.correct} / ${g.questions.length} 题${d.assisted?' · 文本辅助练习':''}`:`已选择 ${d.answers.filter(x=>Number.isInteger(x)).length} / ${g.questions.length} 题`}</p><button class="primary-btn" type="button" ${d.submitted?'data-retry':'data-submit-quiz'}>${d.submitted?'重新练习':'提交并查看解析'}</button></div></form>`;
  }
  function submitQuiz(){
    const g=groups.find(x=>x.id===currentExercise),d=state.quizDrafts[currentExercise];
    if(d.submitted)return;
    const missing=g.questions.findIndex((q,i)=>!Number.isInteger(d.answers[i]));
    if(missing>=0){$('quizStatus').textContent='还有题目没选，请先完成第 '+(missing+1)+' 题。';$('quizForm').querySelectorAll('fieldset')[missing].scrollIntoView({behavior:'smooth',block:'center'});return;}
    d.correct=g.questions.filter((q,i)=>d.answers[i]===q.correctIndex).length;d.submitted=true;
    const attempt={id:d.id,kind:g.id,at:new Date().toISOString(),answers:d.answers.slice(),correct:d.correct,total:g.questions.length,assisted:g.id==='listening'&&d.assisted,contentId:g.id==='reading'?'new-school-day':g.id};
    state.attempts=state.attempts.filter(a=>a.id!==d.id).concat(attempt).slice(-300);
    const ok=save();renderExercise();render();
    const task=({vocabulary:'vocab',grammar:'lesson',reading:'reading'})[g.id];
    if(ok&&task)setTask(task);
    $('quizStatus').textContent+=ok?' · 已保存':' · 暂未保存，请先备份记录';
    $('quizStatus').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function writingCount(){const v=$('writingDraft')?.value||'';if($('writingCounter'))$('writingCounter').textContent=(v.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)||[]).length+' 个英文词 · 最多4000字符';}
  function saveWriting(){
    const value=$('writingDraft').value.trim(),status=$('writingSaveStatus'),d=state.quizDrafts.writing;
    if(!value){status.textContent='请先写下你的自我介绍。';return;}
    const r={id:d.id,at:new Date().toISOString(),text:value,checks:Array.from({length:5},(_,i)=>!!d.checks?.[i])};
    state.writing=state.writing.filter(x=>x.id!==r.id).concat(r);state.drafts.writing=value;
    const ok=save();status.textContent=ok?'写作已保存，完成 '+r.checks.filter(Boolean).length+' / 5 项自查。':'未能保存，请保留草稿并导出备份。';render();
  }
  function openWords(){if(window.Curriculum){Curriculum.openWords();return;}openView('course');$('vocabularyCards').scrollIntoView({behavior:'smooth',block:'start'});}
  function continueLearning(){
    if(window.Curriculum){Curriculum.continueLearning();return;}
    if(!activeLearningSession)startLearningSession();
    openView(state.drafts.lastStudyView||'course');
  }
  async function toggleRecording(){
    const status=$('recordingStatus'),button=$('recordButton');
    if(recordingBusy)return;
    if(recorder?.state==='recording'){recorder.stop();return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status.textContent='这个浏览器暂不支持录音。你仍可按句型开口练习，再完成下方自查；也可以使用手机自带录音工具。';return;}
    recorder=null;recordingBusy=true;button.disabled=true;status.textContent='请在浏览器提示中允许麦克风，以开始这次录音。';
    let stream=null,currentRecorder=null,timer=null,failed=false,finished=false,released=false;
    const release=()=>{
      if(timer!==null){clearInterval(timer);if(recordingTimer===timer)recordingTimer=null;timer=null;}
      if(stream&&!released){released=true;stream.getTracks().forEach(t=>t.stop());}
      if(mediaStream===stream)mediaStream=null;
    };
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      stopEverything();const chunks=[];currentRecorder=new MediaRecorder(stream);recorder=currentRecorder;mediaStream=stream;recordStart=Date.now();
      const recordingUnit=window.Curriculum?Curriculum.unit().id:'';
      currentRecorder.addEventListener('dataavailable',e=>{if(!finished&&e.data.size)chunks.push(e.data);});
      currentRecorder.addEventListener('stop',()=>{
        if(finished)return;finished=true;
        const current=recorder===currentRecorder;release();if(!current)return;recorder=null;
        const sameUnit=!window.Curriculum||Curriculum.unit().id===recordingUnit;
        if(failed||!chunks.length){
          if(sameUnit)status.textContent=failed?'这次录音未能完成，请重试或直接进行口语自查。':'没有收到可播放的录音，请重新录音或直接进行口语自查。';
          button.textContent=sameUnit?'🎙️ 重新录音':'🎙️ 开始录音';button.disabled=false;return;
        }
        if(recordUrl)URL.revokeObjectURL(recordUrl);
        const blob=new Blob(chunks,{type:currentRecorder.mimeType||'audio/webm'});recordUrl=URL.createObjectURL(blob);
        $('recordedAudio').src=recordUrl;$('recordedAudio').hidden=!sameUnit;$('downloadRecording').hidden=!sameUnit;$('downloadRecording').href=recordUrl;$('downloadRecording').download='我的英语表达_'+C.dayKey()+(blob.type.includes('mp4')?'.m4a':'.webm');
        $('recordedAudio').dataset.unitId=recordingUnit;
        if(sameUnit)status.textContent='录音完成。先听回放，再勾选自查。刷新前可下载保存这段录音。';button.textContent=sameUnit?'🎙️ 再录一次':'🎙️ 开始录音';button.disabled=false;
      });
      currentRecorder.addEventListener('error',()=>{if(finished)return;failed=true;release();if(recorder!==currentRecorder)return;const sameUnit=!window.Curriculum||Curriculum.unit().id===recordingUnit;button.textContent=sameUnit?'🎙️ 重新录音':'🎙️ 开始录音';button.disabled=false;if(sameUnit)status.textContent='这次录音未能完成，请重试或直接进行口语自查。';});
      currentRecorder.start();button.disabled=false;button.textContent='■ 停止录音';
      timer=setInterval(()=>{if(recorder!==currentRecorder||currentRecorder.state!=='recording')return;const n=Math.floor((Date.now()-recordStart)/1000);status.textContent='正在录音 '+n+' 秒 · 最长2分钟';if(n>=120)currentRecorder.stop();},500);recordingTimer=timer;
    }catch(e){failed=true;finished=true;release();if(recorder===currentRecorder)recorder=null;status.textContent=e.name==='NotAllowedError'?'未获得麦克风权限。可在浏览器设置中允许录音后重试，或直接进行口语自查。':'没有找到可用的麦克风。可以先按句型开口练习。';button.disabled=false;}finally{recordingBusy=false;}
  }

  window.LearningApp={render,saveDraft,captureDay,syncMode,syncTasks,setTask,continueLearning,openWords,openExercise,toggleRecording,isRecording:()=>recordingBusy||recorder?.state==='recording',tasksForDay:(day,unitId)=>window.Curriculum&&unitId?Curriculum.tasksForDay(day,unitId):C.sessionTasks(state,day,saved),snapshot:()=>JSON.parse(JSON.stringify(state)),clearParentDraft:()=>{delete state.drafts.parent;save();}};
  // Keep both old task controls in sync, and include every new record in backups.
  window.addEventListener('learning:stored',e=>{if(saving||window.restoringSnapshot)return;if(['englishGrowthTasks','englishReflection'].includes(e.detail.key))captureDay();});
  document.querySelectorAll('[data-task],[data-home-task]').forEach(b=>b.addEventListener('pointerdown',ensureDay));
  document.querySelectorAll('[data-study-mode]').forEach(b=>b.addEventListener('click',syncMode));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)checkpointLearning(true);
    else{ensureDay();if(activeLearningSession&&!$('sessionReviewModal').classList.contains('open')){activeLearningSession.resumedAt=Date.now();saveActiveLearningSession();}render();}
    if(document.hidden&&recorder?.state==='recording')recorder.stop();
  });
  window.addEventListener('pagehide',()=>{checkpointLearning(true);mediaStream?.getTracks().forEach(t=>t.stop());});
  setInterval(()=>{if(!document.hidden){ensureDay();if(activeLearningSession&&activeLearningSession.resumedAt)checkpointLearning(false);}},15000);
  window.addEventListener('storage',e=>{if(e.key===key){try{state=C.normalizeState(JSON.parse(e.newValue||'{}'));render();}catch{}}if(e.key===BETA_STORAGE_KEY){betaData=loadBetaData();render();}if(e.key==='englishGrowthTasks'&&!window.Curriculum){try{saved=JSON.parse(e.newValue||'{}');ensureDay();syncTasks();}catch{}}});
  const oldOpen=openView;
  openView=function(id){
    if(!$(id)?.classList.contains('view'))return;
    oldOpen(id);state.lastView=id;if(['course','reading','speaking','assessment'].includes(id))state.drafts.lastStudyView=id;
    save();render();$('mobileMenu').hidden=true;$('mobileMenuButton').setAttribute('aria-expanded','false');
    if(window.Curriculum)Curriculum.onView(id);
    document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===id)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    if(['beta','iteration'].includes(id))document.querySelector('.tools-nav').open=true;
    document.title=(VIEW_NAMES[id]||'学习')+' · AI英语成长空间';
    if(location.hash!=='#'+id)history.replaceState(null,'','#'+id);
  };
  $('mobileMenuButton').addEventListener('click',()=>{const hidden=!$('mobileMenu').hidden;$('mobileMenu').hidden=hidden;$('mobileMenuButton').setAttribute('aria-expanded',String(!hidden));});
  $('assessmentCards').addEventListener('click',e=>{const b=e.target.closest('[data-exercise]');if(b)openExercise(b.dataset.exercise);});
  $('exerciseWorkspace').addEventListener('change',e=>{
    if(e.target.dataset.question!==undefined){state.quizDrafts[currentExercise].answers[Number(e.target.dataset.question)]=Number(e.target.value);save();$('quizStatus').textContent='已选择 '+state.quizDrafts[currentExercise].answers.filter(Number.isInteger).length+' / 5 题';}
    if(e.target.dataset.writingCheck!==undefined){state.quizDrafts.writing.checks[Number(e.target.dataset.writingCheck)]=e.target.checked;save();}
  });
  $('exerciseWorkspace').addEventListener('input',e=>{if(e.target.id==='writingDraft'){saveDraft('writing',e.target.value);writingCount();}});
  $('exerciseWorkspace').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-submit-quiz'))submitQuiz();
    if(b.hasAttribute('data-save-writing'))saveWriting();
    if(b.hasAttribute('data-close-exercise')){$('exerciseWorkspace').hidden=true;$('assessmentCards').scrollIntoView({behavior:'smooth'});}
    if(b.hasAttribute('data-retry')){state.quizDrafts[currentExercise]={id:uid('practice'),answers:[],assisted:false,submitted:false};save();renderExercise();$('exerciseTitle').scrollIntoView({behavior:'smooth',block:'start'});}
    if(b.hasAttribute('data-transcript')){const d=state.quizDrafts[currentExercise];d.showTranscript=!d.showTranscript;if(d.showTranscript&&!d.submitted)d.assisted=true;save();renderExercise();}
    if(b.hasAttribute('data-listen')){const g=groups.find(x=>x.id===currentExercise);if(!selectedVoice()){const d=state.quizDrafts[currentExercise];d.showTranscript=true;if(!d.submitted)d.assisted=true;save();renderExercise();showToast('此设备没有英语语音，已展开文本供你继续练习。');}else {const kind=currentExercise,d=state.quizDrafts[kind];playNaturalSequence(g.audio.turns.map(t=>t.text),g.audio.title+' · 本机朗读',1,()=>{if(state.quizDrafts[kind]!==d)return false;d.showTranscript=true;if(!d.submitted)d.assisted=true;save();if(currentExercise===kind)renderExercise();});}}
  });
  // Replace the vocabulary placeholder with five usable study cards.
  const vocabulary=document.createElement('div');vocabulary.id='vocabularyCards';vocabulary.className='vocabulary-cards';
  const wordData=[['student','学生','I am a student.'],['classmate','同班同学','Amy is my classmate.'],['grade','年级','I am in Grade Seven.'],['friendly','友好的','My new classmate is friendly.'],['nervous','紧张的','At first, I feel a little nervous.']];
  vocabulary.innerHTML='<div class="section-head"><div><h3>今天的5个核心词</h3><p>听例句、遮住中文回想，再标记已经复习。</p></div><button class="outline-btn" onclick="LearningApp.openExercise(\'vocabulary\')">练习这5个词</button></div><div class="word-card-grid">'+wordData.map(([word,meaning,example])=>`<article class="word-study"><div class="word-study-head"><h4>${word}</h4><button class="quiet-btn" type="button" data-word-play="${word}" aria-label="朗读 ${word}">🔊</button></div><details><summary>查看中文</summary><p>${meaning}</p></details><p class="word-example">${example}</p><label class="word-review"><input type="checkbox" data-word-reviewed="${word}" ${state.words.includes(word)?'checked':''}>我复习过了</label></article>`).join('')+'</div>';
  $('course').append(vocabulary);
  vocabulary.addEventListener('change',e=>{const word=e.target.dataset.wordReviewed;if(!word)return;state.words=state.words.filter(w=>w!==word);if(e.target.checked)state.words.push(word);save();if(state.words.length===5)setTask('vocab');});
  vocabulary.addEventListener('click',e=>{const b=e.target.closest('[data-word-play]');if(b)playAudio('audio/word_'+b.dataset.wordPlay+'.mp3',b.dataset.wordPlay+' · 例句');});
  // Keep typed dialogue separate from the demo reply, with useful on-screen prompts.
  const replyForm=document.createElement('form');replyForm.className='dialogue-form';replyForm.innerHTML='<label for="dialogueInput">试着写下你会说的回答</label><div><input id="dialogueInput" maxlength="200" autocomplete="off" placeholder="My name is ..."><button class="outline-btn" type="submit">回应</button></div><p id="dialogueHint" role="status">可以使用昵称或虚构名字。</p>';
  $('speakingPanel').append(replyForm);
  replyForm.addEventListener('submit',e=>{e.preventDefault();const value=$('dialogueInput').value.trim();if(!value)return;if(dialogueStep>=3){$('dialogueHint').textContent='这轮已经结束，点击“开始互动”再试一次。';return;}
    const checks=[/\b(my name is|i am|i'm)\b/i,/\b(i am|i'm)\b/i,/\b(class|grade)\b/i];
    if(!checks[dialogueStep].test(value)){$('dialogueHint').textContent=['试试：My name is ...','试试：I am twelve years old.','试试：I am in Class 1, Grade 7.'][dialogueStep];return;}
    const next=['Nice to meet you. How old are you?','Which class are you in?','Nice work! Try saying your whole introduction aloud.'][dialogueStep];
    $('dialogue').insertAdjacentHTML('beforeend',`<div class="bubble student">${esc(value)}</div><div class="bubble ai">${next}</div>`);dialogueStep++;$('dialogueInput').value='';$('dialogueHint').textContent=dialogueStep<3?'很好，再试着回答下一个问题。':'本轮文本练习完成。现在试着开口说一遍，再做下方口语自查。';saveDraft('dialogueHtml',$('dialogue').innerText);
  });
  $('completeSpeaking').addEventListener('click',()=>{
    if(window.Curriculum){Curriculum.completeSpeaking();return;}
    const boxes=[...document.querySelectorAll('[data-speech-check]')];
    if(!boxes.every(b=>b.checked)){$('recordingStatus').textContent='请先完成并勾选三项自查，再保存。';return;}
    pendingSpeakingRecord=pendingSpeakingRecord||{id:uid('speaking'),at:new Date().toISOString(),type:'self-check'};
    state.speaking=state.speaking.filter(r=>r.id!==pendingSpeakingRecord.id).concat(pendingSpeakingRecord).slice(-300);
    if(save()){
      pendingSpeakingRecord=null;setTask('speaking');boxes.forEach(b=>b.checked=false);
      $('recordingStatus').textContent='这次口语自查已保存，可以在成长档案中查看。';
    }else $('recordingStatus').textContent='本次自查尚未保存。请先备份记录，再点击此按钮重试；重试不会重复计数。';
  });
  // Every pronunciation control has a readable fallback when no voice is installed.
  const oldPlayAudio=playAudio;
  playAudio=function(src,title,rate=1){if(!selectedVoice()){showTextFallback(title||'朗读文本',AUDIO_TEXT[src]||'请查看当前页面的英语例句。');return;}oldPlayAudio(src,title,rate);};window.playAudio=playAudio;
  const oldSpeak=speakText;
  speakText=function(text){if(!selectedVoice()){showTextFallback('练习文本',text);return;}oldSpeak(text);};window.speakText=speakText;
  function showTextFallback(title,text){
    let d=$('textFallback');if(!d){d=document.createElement('dialog');d.id='textFallback';d.className='text-dialog';document.body.appendChild(d);}
    const trigger=document.activeElement;
    d.setAttribute('role','dialog');d.setAttribute('aria-labelledby','textFallbackTitle');
    d.innerHTML=`<h3 id="textFallbackTitle">${esc(title)}</h3><p class="mini-note">当前设备无法完成本机英语朗读。可以先看文本练习，或到发音校准中选择已安装的英语语音。</p><p class="english-passage">${esc(text)}</p><div class="text-dialog-actions"><button type="button" class="primary-btn">继续学习</button></div>`;
    const close=()=>{if(typeof d.close==='function')d.close();else d.removeAttribute('open');if(trigger&&trigger.isConnected&&typeof trigger.focus==='function')trigger.focus();};
    const button=d.querySelector('button');button.onclick=close;
    d.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}};
    if(typeof d.showModal==='function'){if(!d.open)d.showModal();}
    else{d.classList.add('text-dialog-fallback');d.setAttribute('open','');}
    button.focus();
  }
  window.showLearningTextFallback=showTextFallback;
  // Restore drafts without submitting them again.
  $('readingAnswer').value=state.drafts.readingAnswer||'';if(state.drafts.readingFeedback)$('readingFeedback').textContent=state.drafts.readingFeedback;
  $('readingAnswer').addEventListener('input',e=>saveDraft('readingAnswer',e.target.value));
  document.querySelectorAll('[data-answer]').forEach(b=>{if(b.textContent.trim()===state.drafts.grammar){b.classList.add(b.dataset.answer==='correct'?'correct':'wrong');$('grammarFeedback').textContent=b.dataset.answer==='correct'?'上次选择 am：正确。I 与 am 搭配。':'上次选择 '+b.textContent.trim()+'：再试试，I 与 am 搭配。';}});
  ['parentHardest','parentFavorite','parentObservation'].forEach(id=>{$(id).value=state.drafts.parent?.[id]||'';$(id).addEventListener('input',()=>{state.drafts.parent=Object.fromEntries(['parentHardest','parentFavorite','parentObservation'].map(k=>[k,$(k).value]));save();});});
  document.querySelectorAll('.word').forEach(el=>{el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',el.dataset.tip);const show=()=>showToast(el.dataset.tip);el.addEventListener('click',show);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});});
  document.querySelector('#aiPanel small').textContent='本主题学习助手 · 按固定知识点提供提示';$('aiInput').setAttribute('aria-label','向学习助手提问');
  document.querySelector('#aiLog .ai-msg').textContent='今天可以一起复习 be 动词、5个核心词和自我介绍。试试问：为什么 I 用 am？';
  const grammarMore=document.createElement('button');grammarMore.type='button';grammarMore.className='outline-btn';grammarMore.textContent='继续做5道语法题';grammarMore.addEventListener('click',()=>openExercise('grammar'));$('grammarPractice').append(grammarMore);
  const readingMore=document.createElement('button');readingMore.type='button';readingMore.className='outline-btn';readingMore.textContent='做5道阅读理解题';readingMore.addEventListener('click',()=>openExercise('reading'));$('readingFeedback').after(readingMore);
  const nextSteps={vocab:['单词卡','course'],lesson:['语法练习','course'],reading:['进入阅读','reading'],speaking:['开始听说','speaking'],review:['填写感受','today']};
  document.querySelectorAll('#taskList .task').forEach(row=>{const id=row.querySelector('input').dataset.task;const button=document.createElement('button');button.type='button';button.className='task-entry';button.textContent=nextSteps[id][0];button.addEventListener('click',e=>{e.preventDefault();if(window.Curriculum){Curriculum.openTask(id);return;}if(id==='vocab')openWords();else if(id==='lesson')openExercise('grammar');else{openView(nextSteps[id][1]);if(id==='review')$('reflection').focus();}});row.append(button);});
  // The mode time is kept in its own span, separate from the task action.
  taskBoxes.forEach(b=>b.closest('.task').querySelectorAll('span').item(1).classList.add('task-time'));
  // Accessibility for existing overlays: focus enters, Tab stays inside, Escape returns focus.
  let lastFocus=null;
  const modals=[...document.querySelectorAll('.onboarding-modal,.session-review-modal,.feedback-modal,.pronunciation-lab')];
  const focusables=el=>[...el.querySelectorAll('button,input,select,textarea,a[href],summary')].filter(x=>!x.disabled&&x.getClientRects().length);
  modals.forEach(m=>{m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');new MutationObserver(()=>{if(m.classList.contains('open')){lastFocus=document.activeElement;focusables(m)[0]?.focus();}else if(lastFocus?.isConnected)lastFocus.focus();}).observe(m,{attributes:true,attributeFilter:['class']});});
  document.addEventListener('keydown',e=>{const m=modals.find(x=>x.classList.contains('open'));if(!m){if(e.key==='Escape'){$('mobileMenu').hidden=true;aiPanel.classList.remove('open');}return;}if(e.key==='Escape'){e.preventDefault();if(m.id==='sessionReviewModal')closeSessionReview();else if(m.id==='learnerSetupModal')closeLearnerSetup();else if(m.id==='pronunciationLab')closePronunciationLab();else closeFeedbackModal();}if(e.key==='Tab'){const f=focusables(m);if(!f.length)return;if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length - 1].focus();}else if(!e.shiftKey&&document.activeElement===f[f.length - 1]){e.preventDefault();f[0].focus();}}});
  // Label real timings accurately and keep initial settings optional.
  document.querySelector('#sessionControlCard .home-tag').textContent='⏱️ 本次学习计时';
  $('sessionControlTitle').textContent=activeLearningSession?'本次学习正在记录':'给今天留下一点进步';
  $('sessionControlDescription').textContent='开始后记录前台停留时间，切到后台会暂停；结束时保存一次简短自评。';
  $('sidebarProfileMeta').textContent=(learnerProfile?.grade||'七年级')+' · 一起慢慢进步';
  $('aiToggle').setAttribute('aria-expanded','false');$('aiToggle').addEventListener('click',()=>{$('aiToggle').setAttribute('aria-expanded',String(aiPanel.classList.contains('open')));if(aiPanel.classList.contains('open'))$('aiInput').focus();});
  syncMode();render();
  const desired=location.hash.slice(1)||state.lastView;if($(desired)?.classList.contains('view'))openView(desired);
})();
