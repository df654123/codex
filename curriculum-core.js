(function(root){
  'use strict';
  const record=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
  const string=x=>typeof x==='string';
  const identity=x=>string(x)&&/^[a-zA-Z0-9][a-zA-Z0-9_:.-]{0,180}$/.test(x);
  const timestamp=x=>string(x)&&Number.isFinite(Date.parse(x));
  const kinds=['vocabulary','grammar','reading','listening'];
  const taskKeys=['vocab','lesson','reading','speaking','review'];
  const answers=x=>Array.isArray(x)&&x.length<=5&&x.every(a=>a==null||Number.isInteger(a)&&a>=0&&a<4);
  const checks=x=>Array.isArray(x)&&x.length<=5&&x.every(a=>typeof a==='boolean'||a==null);
  const taskMap=x=>record(x)&&Object.entries(x).every(([k,v])=>k==='_date'?/^\d{4}-\d{2}-\d{2}$/.test(v):k==='_unit'?identity(v):taskKeys.includes(k)&&typeof v==='boolean');
  const quizDraft=x=>record(x)&&identity(x.id)&&answers(x.answers)&&(x.assisted===undefined||typeof x.assisted==='boolean')&&(x.showTranscript===undefined||typeof x.showTranscript==='boolean')&&(x.submitted===undefined||typeof x.submitted==='boolean')&&(!x.submitted||(x.answers.length>=1&&x.answers.length<=5&&x.answers.every(Number.isInteger)));
  const mistake=x=>record(x)&&['prompt','chosen','answer','explanation'].every(k=>string(x[k]));
  const attempt=x=>record(x)&&identity(x.id)&&identity(x.key)&&identity(x.unitId)&&kinds.includes(x.kind)&&timestamp(x.at)&&answers(x.answers)&&x.answers.length>=1&&x.answers.length<=5&&x.answers.every(Number.isInteger)&&x.total===x.answers.length&&Number.isInteger(x.correct)&&x.correct>=0&&x.correct<=x.total&&(x.assisted===undefined||typeof x.assisted==='boolean')&&(x.variant===undefined||identity(x.variant))&&(x.mistakes===undefined||(Array.isArray(x.mistakes)&&x.mistakes.length<=5&&x.mistakes.every(mistake)));
  const writing=x=>record(x)&&string(x.text)&&checks(x.checks)&&(x.savedAt===undefined||timestamp(x.savedAt));
  const speaking=x=>record(x)&&checks(x.checks)&&(x.savedAt===undefined||timestamp(x.savedAt));
  const selfChecked=(entry,count)=>!!entry?.savedAt&&entry.checks?.length===count&&entry.checks.every(Boolean);
  const days=x=>record(x)&&Object.entries(x).every(([date,units])=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&record(units)&&Object.entries(units).every(([id,t])=>identity(id)&&taskMap(t)));
  const validators={quizDrafts:quizDraft,writing,speaking,words:x=>Array.isArray(x)&&x.every(string)};
  function validate(s){
    const fail=()=>{throw Error('同步学习记录格式损坏，请选择完整的备份文件。');};
    if(!record(s)||(s.version!==undefined&&s.version!==1))fail();
    if(s.attempts!==undefined&&(!Array.isArray(s.attempts)||s.attempts.some(x=>!attempt(x))))fail();
    for(const [field,valid] of Object.entries(validators))if(s[field]!==undefined&&(!record(s[field])||Object.entries(s[field]).some(([k,v])=>!identity(k)||!valid(v))))fail();
    if(s.dailyPlans!==undefined&&!days(s.dailyPlans))fail();
    if(s.selectedUnit!==undefined&&!identity(s.selectedUnit))fail();
    if(s.selectedBook!==undefined&&!identity(s.selectedBook))fail();
    return true;
  }
  function normalize(value){
    const s=record(value)?value:{};
    const n={version:1,selectedBook:identity(s.selectedBook)?s.selectedBook:'7a',selectedUnit:identity(s.selectedUnit)?s.selectedUnit:'7a-u1',attempts:[...new Map((Array.isArray(s.attempts)?s.attempts:[]).filter(attempt).map(a=>[a.id,a])).values()].slice(-3000),dailyPlans:{}};
    for(const [field,valid] of Object.entries(validators))n[field]=Object.fromEntries(Object.entries(record(s[field])?s[field]:{}).filter(([k,v])=>identity(k)&&valid(v)));
    for(const [field,count] of [['writing',5],['speaking',3]])for(const [id,entry] of Object.entries(n[field])){
      const current={...entry,checks:[...entry.checks]};
      if(!selfChecked(current,count)||(field==='writing'&&!current.text.trim()))delete current.savedAt;
      n[field][id]=current;
    }
    for(const [date,units] of Object.entries(record(s.dailyPlans)?s.dailyPlans:{})){
      if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&record(units))n.dailyPlans[date]=Object.fromEntries(Object.entries(units).filter(([id,t])=>identity(id)&&taskMap(t)));
    }
    return n;
  }
  function quizKey(unitId,kind,contentId='main'){return [unitId,kind,contentId].join('::');}
  function score(questions,choices){
    if(!Array.isArray(choices)||questions.length!==choices.length||questions.some((q,i)=>!Number.isInteger(choices[i])||choices[i]<0||choices[i]>=q.options.length))throw Error('请先完成全部题目。');
    const mistakes=questions.map((q,i)=>q.correctIndex===choices[i]?-1:i).filter(i=>i>=0);
    return {correct:questions.length-mistakes.length,total:questions.length,mistakes};
  }
  function latest(s,unitId){
    const result={vocabulary:null,grammar:null,reading:null,listening:null};
    [...s.attempts].filter(a=>a.unitId===unitId).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).forEach(a=>{if(!(a.kind==='listening'&&a.assisted))result[a.kind]=a;});
    return result;
  }
  function rememberPlan(s,tasks){
    if(!taskMap(tasks)||!tasks._date||!tasks._unit)return;
    if(!s.dailyPlans[tasks._date])s.dailyPlans[tasks._date]={};
    s.dailyPlans[tasks._date][tasks._unit]={...tasks};
  }
  function tasksFor(s,date,unitId){return {...(s.dailyPlans[date]?.[unitId]||{}),_date:date,_unit:unitId};}
  const vocabSets=unit=>unit.vocabularyAlignment?Array.from({length:Math.ceil(unit.vocabulary.length/5)},(_,i)=>'set'+(i+1)):['set1','set2'];
  const revisionMatches=(a,unit)=>a.kind!=='vocabulary'||(a.contentRevision||1)===(unit.vocabularyRevision||1);
  function progress(s,unit){
    const tried=kind=>s.attempts.some(a=>a.unitId===unit.id&&a.kind===kind);
    const triedSet=(kind,id)=>s.attempts.some(a=>a.unitId===unit.id&&a.kind===kind&&a.key===quizKey(unit.id,kind,id)&&revisionMatches(a,unit));
    const grammar=(unit.grammarKeys||[]).length?unit.grammarKeys.every(id=>s.attempts.some(a=>a.unitId===unit.id&&a.kind==='grammar'&&a.key===quizKey(unit.id,'grammar',id))):tried('grammar');
    const vocabulary=unit.vocabulary.every(w=>(s.words[unit.id]||[]).includes(w.word))||vocabSets(unit).every(id=>triedSet('vocabulary',id));
    const complete={vocabulary,grammar,reading:tried('reading'),listening:tried('listening'),speaking:selfChecked(s.speaking[unit.id],3),writing:selfChecked(s.writing[unit.id],5)&&!!s.writing[unit.id].text.trim()};
    const done=Object.values(complete).filter(Boolean).length;
    return {done,total:6,percent:Math.round(done/6*100),complete};
  }
  function nextActivity(s,unit,onlyKind){
    const complete=progress(s,unit).complete;
    const kind=['vocabulary','grammar','reading','listening','speaking','writing'].find(k=>(!onlyKind||k===onlyKind)&&!complete[k]);
    if(!kind)return {kind:'complete'};
    if(kind==='vocabulary'||kind==='grammar'){
      const variants=kind==='vocabulary'?vocabSets(unit):unit.grammarKeys||[];
      const variant=variants.find(id=>!s.attempts.some(a=>a.unitId===unit.id&&a.kind===kind&&a.key===quizKey(unit.id,kind,id)&&revisionMatches(a,unit)));
      return {kind,...(variant?{variant}:{})};
    }
    return {kind};
  }
  function wordCount(text){return (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)||[]).length;}
  const api={normalize,validate,quizKey,score,latest,rememberPlan,tasksFor,progress,nextActivity,wordCount};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.CurriculumCore=api;
})(typeof window==='undefined'?globalThis:window);
