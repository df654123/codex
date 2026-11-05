(function (root) {
  'use strict';
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const modes = {
    standard: {minutes:35, tasks:['vocab','lesson','reading','speaking','review'], times:[8,10,10,5,2]},
    light: {minutes:18, tasks:['vocab','lesson','reading','speaking'], times:[5,6,4,3]}
  };
  function mode(value) { return modes[value === 'light' ? 'light' : 'standard']; }
  function dayKey(value = new Date()) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }
  function progress(tasks, selectedMode) {
    const keys = mode(selectedMode).tasks;
    const done = keys.filter(key => tasks?.[key] === true).length;
    return {done,total:keys.length,percent:Math.round(done / keys.length * 100)};
  }
  const kinds=['listening','vocabulary','grammar','reading'];
  const taskKeys=modes.standard.tasks;
  const dated=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dayKey(value+'T04:00:00Z')===value;
  const timestamp=value=>typeof value==='string' && Number.isFinite(Date.parse(value));
  const identity=value=>typeof value==='string' && value.length>0;
  const answers=value=>Array.isArray(value) && value.length<=5 && value.every(x=>x==null || (Number.isInteger(x)&&x>=0&&x<4));
  const checks=value=>Array.isArray(value) && value.length<=5 && value.every(x=>x==null||typeof x==='boolean');
  const validTasks=value=>record(value) && Object.entries(value).every(([k,v])=>k==='_date'?dated(v):k==='_unit'?typeof v==='string'&&/^[789][ab]-u\d+$/.test(v):taskKeys.includes(k)&&typeof v==='boolean');
  const validDay=value=>record(value)&&validTasks(value.tasks)&&(value.reflection===undefined||typeof value.reflection==='string')&&(value.mode===undefined||['light','standard'].includes(value.mode));
  const validAttempt=a=>record(a)&&identity(a.id)&&kinds.includes(a.kind)&&timestamp(a.at)&&Number.isInteger(a.correct)&&a.total===5&&a.correct>=0&&a.correct<=a.total&&(a.answers===undefined||(answers(a.answers)&&a.answers.length===5&&a.answers.every(Number.isInteger)))&&(a.assisted===undefined||typeof a.assisted==='boolean');
  const validQuiz=d=>record(d)&&identity(d.id)&&answers(d.answers)&&(d.checks===undefined||checks(d.checks))&&(d.submitted===undefined||typeof d.submitted==='boolean')&&(d.assisted===undefined||typeof d.assisted==='boolean')&&(d.showTranscript===undefined||typeof d.showTranscript==='boolean')&&(!d.submitted||(Number.isInteger(d.correct)&&d.correct>=0&&d.correct<=5&&d.answers.length===5&&d.answers.every(Number.isInteger)));
  const validSpeaking=r=>record(r)&&identity(r.id)&&timestamp(r.at)&&r.type==='self-check';
  const validWriting=r=>record(r)&&identity(r.id)&&timestamp(r.at)&&typeof r.text==='string'&&Array.isArray(r.checks)&&r.checks.length===5&&r.checks.every(x=>typeof x==='boolean');
  const validDraft=(k,v)=>k==='parent'?record(v)&&Object.values(v).every(x=>typeof x==='string'):typeof v==='string';
  function validateState(s) {
    const fail=()=>{throw new Error('学习记录包含损坏的答题、草稿或自查数据，请选择完整的备份。');};
    if(!record(s)||(s.version!==undefined&&s.version!==1))fail();
    for(const [field,valid] of [['attempts',validAttempt],['speaking',validSpeaking],['writing',validWriting]]){
      if(s[field]!==undefined&&(!Array.isArray(s[field])||s[field].some(x=>!valid(x))))fail();
    }
    if(s.days!==undefined&&(!record(s.days)||Object.entries(s.days).some(([k,v])=>!dated(k)||!validDay(v))))fail();
    if(s.quizDrafts!==undefined&&(!record(s.quizDrafts)||Object.entries(s.quizDrafts).some(([k,v])=>![...kinds,'writing'].includes(k)||!validQuiz(v))))fail();
    if(s.drafts!==undefined&&(!record(s.drafts)||Object.entries(s.drafts).some(([k,v])=>!validDraft(k,v))))fail();
    if(s.words!==undefined&&(!Array.isArray(s.words)||s.words.some(x=>typeof x!=='string')))fail();
    if(s.lastView!==undefined&&typeof s.lastView!=='string')fail();
    return true;
  }
  function normalizeState(value) {
    const s = record(value) ? value : {};
    const unique=(list,valid,limit)=>[...new Map((Array.isArray(list)?list:[]).filter(valid).map(r=>[r.id,r])).values()].slice(-limit);
    return {
      version:1,
      days:Object.fromEntries(Object.entries(record(s.days)?s.days:{}).filter(([k,v])=>dated(k)&&validDay(v))),
      attempts:unique(s.attempts,validAttempt,300),
      drafts:Object.fromEntries(Object.entries(record(s.drafts)?s.drafts:{}).filter(([k,v])=>validDraft(k,v))),
      quizDrafts:Object.fromEntries(Object.entries(record(s.quizDrafts)?s.quizDrafts:{}).filter(([k,v])=>[...kinds,'writing'].includes(k)&&validQuiz(v)).map(([k,v])=>[k,{...v,checks:v.checks||[],submitted:!!v.submitted,assisted:!!v.assisted}])),
      words:Array.isArray(s.words) ? s.words.filter(x => typeof x === 'string') : [],
      speaking:unique(s.speaking,validSpeaking,300),
      writing:unique(s.writing,validWriting,100),
      lastView:typeof s.lastView === 'string' ? s.lastView : 'home'
    };
  }
  function dayRecord(state, day = dayKey()) {
    if (!record(state.days[day])) state.days[day] = {tasks:{},reflection:''};
    if (!record(state.days[day].tasks)) state.days[day].tasks = {};
    return state.days[day];
  }
  function sessionDate(session) {return dated(session.learningDate)?session.learningDate:dayKey(session.endAt||session.startAt);}
  function sessionTasks(state,day,current) {return {...(current?._date===day?current:state.days[day]?.tasks||{})};}
  function mergeLearningSessions(records,pending) {
    const unique=new Map((Array.isArray(records)?records:[]).filter(record).map(r=>[r.id||r.endAt||r.startAt,r]));
    if(record(pending)&&identity(pending.id))unique.set(pending.id,pending);
    return [...unique.values()].sort((a,b)=>(Date.parse(b.endAt||b.startAt)||0)-(Date.parse(a.endAt||a.startAt)||0));
  }
  function latestScores(state) {
    const scores={listening:null,vocabulary:null,grammar:null,reading:null};
    [...state.attempts].sort((a,b) => Date.parse(a.at) - Date.parse(b.at)).forEach(a => {
      if (Object.prototype.hasOwnProperty.call(scores,a.kind) && !(a.kind === 'listening' && a.assisted)) scores[a.kind] = {...a,percent:Math.round(a.correct / a.total * 100)};
    });
    return scores;
  }
  function summary(state, sessions = [], now = new Date()) {
    const unique=new Map();
    sessions.filter(record).forEach(s => {
      const key=s.id || s.endAt || s.startAt;
      if(key && !unique.has(key)) unique.set(key,s);
    });
    const valid=[...unique.values()];
    const dates=new Set(valid.map(sessionDate).filter(Boolean));
    for(const [day,r] of Object.entries(state.days)) if(record(r) && Object.values(r.tasks||{}).some(v=>v===true)) dates.add(day);
    state.attempts.forEach(a=>{const day=dayKey(a.at);if(day)dates.add(day);});
    state.speaking.forEach(s=>{const day=dayKey(s.at);if(day)dates.add(day);});
    const today=dayKey(now);
    let cursor=new Date(today+'T04:00:00Z');
    if(!dates.has(today)) cursor.setUTCDate(cursor.getUTCDate()-1);
    let streak=0;
    while(dates.has(dayKey(cursor))){streak++;cursor.setUTCDate(cursor.getUTCDate()-1);}
    const latest=Object.values(latestScores(state)).filter(Boolean);
    const correct=latest.reduce((n,a)=>n+a.correct,0), answered=latest.reduce((n,a)=>n+a.total,0);
    return {
      days:dates.size,streak,
      durationMs:valid.reduce((n,s)=>n+(Number.isFinite(s.durationMs)&&s.durationMs>0?Math.min(s.durationMs,21600000):0),0),
      attempts:state.attempts.length,correct,answered,percent:answered?Math.round(correct/answered*100):null,
      reading:new Set(state.attempts.filter(a=>a.kind==='reading').map(a=>a.contentId||'new-school-day')).size,
      speaking:state.speaking.length
    };
  }
  const api={mode,dayKey,progress,normalizeState,validateState,validTasks,dayRecord,sessionDate,sessionTasks,mergeLearningSessions,latestScores,summary};
  if(typeof module !== 'undefined' && module.exports) module.exports=api;
  root.EnglishCore=api;
})(typeof window === 'undefined' ? globalThis : window);
