/* Conservative spelling checks: never strip all punctuation or accept synonyms. */
(function(root){
  'use strict';
  const normalize=v=>String(v??'').normalize('NFKC').trim().toLowerCase().replace(/[‘’ʼ]/g,"'").replace(/\b(sth|sb)\.(?=\s|$)/g,'$1').replace(/\bp\.m\.(?=\s|$)/g,'pm').replace(/\s+/g,' ');
  const variants={favourite:['favorite'],colour:['color'],colours:['colors'],centre:['center'],practise:['practice'],practising:['practicing']};
  function compare(input,expected){
    const a=normalize(input),b=normalize(expected);
    if(a&&b&&a===b)return {correct:true,kind:'standard',note:''};
    if(a&&variants[b]?.includes(a))return {correct:true,kind:'variant',note:'这是规范的美式拼写；本题教材形式为 '+expected+'。'};
    return {correct:false,kind:'different',note:''};
  }
  const api={normalize,compare};root.SpellingPolicy=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
