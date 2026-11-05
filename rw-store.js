/* Each practice pack is independent of textbook progress and other pack writes. */
(function (root, make) {
  'use strict';
  const api=make();
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root && root.document)root.RWStore=api.connect(()=>root.localStorage,()=>!!root.restoringSnapshot);
})(typeof window==='undefined'?null:window, function () {
  'use strict';
  const ids=['rw-7a','rw-7b','rw-8a','rw-8b','rw-9a','rw-9b'];
  const key=id=>'englishReadWriteV41:'+id, archiveKey='englishReadWriteV41:preserved';
  const empty=()=>({choices:[null,null,null],short:'',gaps:[null,null,null,null,null],reviewed:false,plan:'',draft:'',revision:'',checks:[false,false,false,false],note:''});
  const fields=Object.keys(empty()),copy=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const exact=(v,keys)=>obj(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
  const picks=(a,n,max)=>Array.isArray(a)&&a.length===n&&Array.from(a).every(v=>v===null||Number.isInteger(v)&&v>=0&&v<=max);
  function validRecord(r,id){
    if(!exact(r,fields)||!picks(r.choices,3,3)||!picks(r.gaps,5,6)||typeof r.reviewed!=='boolean')return false;
    if(!Array.isArray(r.checks)||r.checks.length!==4||!Array.from(r.checks).every(v=>typeof v==='boolean'))return false;
    if(!['short','plan','draft','revision','note'].every(k=>typeof r[k]==='string'&&r[k].length<=(k==='short'?500:20000)))return false;
    if(r.checks.some(Boolean)&&!r.draft.trim())return false;
    if(!r.reviewed)return true;
    const n=(r.short.match(/[a-z0-9]+(?:['’\-][a-z0-9]+)*/gi)||[]).length;
    return r.choices.every(v=>v!==null)&&n>=1&&n<=5&&!/\p{Script=Han}/u.test(r.short)&&
      (!id.startsWith('rw-9')||(r.gaps.every(v=>v!==null)&&new Set(r.gaps).size===5));
  }
  function validate(s){
    if(!exact(s,['schemaVersion','records','preserved'])||s.schemaVersion!==1||!obj(s.records)||!Object.keys(s.records).every(id=>ids.includes(id)&&validRecord(s.records[id],id))||!Array.isArray(s.preserved)||!s.preserved.every(v=>exact(v,['id','raw'])&&ids.includes(v.id)&&typeof v.raw==='string'))throw Error('中考读写专项备份结构无效，未恢复。');
    return true;
  }
  function entries(s){validate(s);return [...ids.map(id=>[key(id),s.records[id]?JSON.stringify(s.records[id]):null]),[archiveKey,s.preserved.length?JSON.stringify(s.preserved):null]];}
  function connect(storage,restoring=()=>false){
    const work=new Map();
    function load(id){
      if(!ids.includes(id))throw Error('专题不存在。');
      let raw=null;
      try{raw=storage().getItem(key(id));if(raw===null)return {record:empty(),raw};const record=JSON.parse(raw);if(!validRecord(record,id))throw Error();return {record,raw};}
      catch{return {record:empty(),raw,failed:true};}
    }
    function local(id){if(!work.has(id))work.set(id,{base:load(id).record,pending:{}});return work.get(id);}
    function get(id){const w=local(id);return copy({...w.base,...w.pending});}
    // Only apply a pending review to the answers/draft it was made against.
    // If another page owns the entire newer version, keep its own review.
    function overlay(record,w){
      const merged={...record,...w.pending};
      const answers=['choices','short','gaps'];
      const unseen=keys=>keys.some(k=>!(k in w.pending)&&!same(w.base[k],record[k]));
      const matchesDisk=keys=>keys.every(k=>same(merged[k],record[k]));
      if(w.pending.reviewed===true&&unseen(answers))merged.reviewed=matchesDisk(answers)&&record.reviewed;
      if(w.pending.checks?.some(Boolean)&&!('draft' in w.pending)&&w.base.draft!==record.draft)merged.checks=record.checks;
      return merged;
    }
    function update(id,patch){
      const w=local(id),current=get(id);
      if(restoring())return {saved:false,message:'正在恢复整站备份，请稍后编辑。'};
      if(!obj(patch)||!Object.keys(patch).every(k=>fields.includes(k)))return {saved:false,message:'无法识别本次修改。'};
      const changes={...patch};
      if(['choices','short','gaps'].some(k=>k in patch&&!same(patch[k],current[k])))changes.reviewed=false;
      if('draft' in patch&&patch.draft!==current.draft)changes.checks=[false,false,false,false];
      if(!validRecord({...current,...changes},id))return {saved:false,message:'输入超出范围或答题不完整。'};
      Object.assign(w.pending,copy(changes));
      const disk=load(id);
      const fail=message=>({saved:false,message});
      if(disk.failed)return fail('本机记录无法读取，改动保留在本页。请先导出作品或整站备份，勿关闭此页。');
      if(Object.keys(w.pending).some(k=>!same(disk.record[k],w.base[k])&&!same(disk.record[k],w.pending[k])))return fail('另一页也改了同一项，两页内容尚未合并。请先导出本页作品，再重新打开核对。');
      const merged=overlay(disk.record,w);
      if(!validRecord(merged,id))return fail('记录发生变化，请先导出作品后重新核对。');
      try{storage().setItem(key(id),JSON.stringify(merged));w.base=copy(merged);w.pending={};return {saved:true,message:'已保存在当前浏览器。'};}
      catch{return fail('暂未写入本机，改动保留在本页。请先导出作品或整站备份。');}
    }
    function snapshot(){
      const s={schemaVersion:1,records:{},preserved:[]};
      try{const archived=JSON.parse(storage().getItem(archiveKey)||'[]');if(Array.isArray(archived))s.preserved=archived.filter(v=>exact(v,['id','raw'])&&ids.includes(v.id)&&typeof v.raw==='string');}catch{/* Storage can be disabled; keep in-memory work. */}
      for(const id of ids){const d=load(id),w=work.get(id),pending=w&&Object.keys(w.pending).length;
        let value=d.failed&&w?w.base:d.record;
        if(pending){const merged=overlay(value,w);value=validRecord(merged,id)?merged:{...w.base,...w.pending};}
        if(d.raw!==null||pending||!same(value,empty()))s.records[id]=copy(value);
        if(d.raw!==null&&(d.failed||(pending&&Object.keys(w.pending).some(k=>!same(d.record[k],w.base[k])&&!same(d.record[k],w.pending[k]))))&&!s.preserved.some(v=>v.id===id&&v.raw===d.raw))s.preserved.push({id,raw:d.raw});
      }
      validate(s);return s;
    }
    return {get,update,snapshot,validate,entries};
  }
  return {validate,entries,connect,empty,ids:ids.slice()};
});
