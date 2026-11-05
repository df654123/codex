(function(root){
  'use strict';
  const record=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
  const identity=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,180}$/.test(x);
  const timestamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
  const choices=x=>Array.isArray(x)&&x.length<=5&&Array.from(x).every(a=>a==null||Number.isInteger(a)&&a>=0&&a<4);
  const complete=x=>choices(x)&&x.length===5&&Array.from(x).every(Number.isInteger);
  const draft=x=>record(x)&&choices(x.answers)&&typeof x.submitted==='boolean'&&timestamp(x.at)&&(!x.submitted||complete(x.answers));
  const result=x=>record(x)&&complete(x.answers)&&x.total===5&&Number.isInteger(x.correct)&&x.correct>=0&&x.correct<=5&&timestamp(x.at);
  const note=x=>record(x)&&typeof x.text==='string'&&x.text.length<=5000&&timestamp(x.at);
  const fields={sections:identity,drafts:draft,results:result,notes:note};
  function validate(s){
    const fail=()=>{throw Error('读书记录格式损坏，请选择本站导出的完整备份。');};
    if(!record(s)||(s.version!==undefined&&s.version!==1))fail();
    if(s.selectedBook!==undefined&&!identity(s.selectedBook))fail();
    if(s.filterGrade!==undefined&&!['all','7','8','9'].includes(s.filterGrade))fail();
    for(const [name,valid] of Object.entries(fields)) if(s[name]!==undefined&&(!record(s[name])||Object.entries(s[name]).some(([k,v])=>!identity(k)||!valid(v))))fail();
    return true;
  }
  function normalize(value){
    const s=record(value)?value:{};
    const n={version:1,selectedBook:identity(s.selectedBook)?s.selectedBook:'wind-in-the-willows',filterGrade:['all','7','8','9'].includes(s.filterGrade)?s.filterGrade:'7'};
    for(const [name,valid] of Object.entries(fields))n[name]=Object.fromEntries(Object.entries(record(s[name])?s[name]:{}).filter(([k,v])=>identity(k)&&valid(v)));
    return n;
  }
  function key(bookId,sectionId){return bookId+'::'+sectionId;}
  function progress(state,book){
    const done=book.sections.filter(s=>Object.prototype.hasOwnProperty.call(state.results,key(book.id,s.id))).length;
    return {done,total:book.sections.length,percent:book.sections.length?Math.round(done/book.sections.length*100):0};
  }
  function score(questions,answers){
    if(!Array.isArray(answers)||answers.length!==questions.length||questions.some((q,i)=>!Number.isInteger(answers[i])||answers[i]<0||answers[i]>=q.options.length))throw Error('请完成全部 5 道题后再提交。');
    return {correct:questions.filter((q,i)=>q.correctIndex===answers[i]).length,total:questions.length};
  }
  const api={normalize,validate,key,progress,score};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.ClassicsCore=api;
})(typeof window==='undefined'?globalThis:window);
