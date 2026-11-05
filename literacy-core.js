(function (root) {
  'use strict';
  /* Public API (schemaVersion 1):
   * createState() -> {schemaVersion:1, records:{}}.
   * validate(value) -> true or throws; strict boundary for backup imports.
   * normalize(value) -> deep copy containing only structurally valid records.
   * updateField(state, unitId, field, text, isoTime), setCheck(state,...,bool,isoTime)
   * mutate a draft, revoke its submission and reset the changed field's check.
   * submit(state, unitId, isoTime) requires four responses and four self-checks;
   * it saves a lastSubmission snapshot, never a proficiency score.
   * merge(local, incoming, protectedUnitIds?) -> deep merged copy. Newer records
   * win except for explicitly protected unsaved units. Neither argument mutates.
   * reconcile(local,incoming,baseline,edits?) -> {state,conflicts}: three-way
   * field merge. edits[unitId][field] is the field/check before this page's first
   * edit; retain it after saves to recognize concurrent snapshots. Conflicting
   * text stays local in state and both variants are returned for explicit choice.
   * Fields/check IDs: evidence, expression, comparison, reflection.
   * Record: {fields, checks, updatedAt, submittedAt:null|ISO, lastSubmission:null|
   * {fields,checks,submittedAt:ISO}}. All timestamps are canonical UTC ISO strings.
   */
  const FIELDS = ['evidence','expression','comparison','reflection'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(value,k));
  const unitId = value => typeof value === 'string' && /^(?:[78][ab]-u[1-8]|9a-u[1-8]|9b-u[1-4])$/.test(value);
  const timestamp = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
    try { return new Date(value).toISOString() === value; } catch { return false; }
  };
  const texts = value => exact(value,FIELDS) && FIELDS.every(k => typeof value[k] === 'string' && value[k].length <= 20000);
  const checks = value => exact(value,FIELDS) && FIELDS.every(k => typeof value[k] === 'boolean');
  const ready = value => FIELDS.every(k => value.fields[k].trim() && value.checks[k]);
  const snapshot = value => exact(value,['fields','checks','submittedAt']) && texts(value.fields) && checks(value.checks) && timestamp(value.submittedAt) && ready(value);
  function validRecord(value) {
    if (!exact(value,['fields','checks','updatedAt','submittedAt','lastSubmission']) || !texts(value.fields) || !checks(value.checks) || !timestamp(value.updatedAt)) return false;
    if (value.lastSubmission !== null && (!snapshot(value.lastSubmission) || value.lastSubmission.submittedAt > value.updatedAt)) return false;
    if (value.submittedAt === null) return true;
    return timestamp(value.submittedAt) && value.lastSubmission !== null && value.submittedAt === value.lastSubmission.submittedAt && ready(value) && FIELDS.every(k => value.fields[k] === value.lastSubmission.fields[k] && value.checks[k] === value.lastSubmission.checks[k]);
  }
  function createState() { return {schemaVersion:1,records:{}}; }
  function validate(value) {
    if (!exact(value,['schemaVersion','records']) || value.schemaVersion !== 1 || !object(value.records) || Object.keys(value.records).length > 44 || Object.entries(value.records).some(([id,r]) => !unitId(id) || !validRecord(r))) {
      throw Error('学以致用记录格式损坏或版本不匹配，请选择完整的本站备份。');
    }
    return true;
  }
  function normalize(value) {
    const state = createState();
    if (!object(value) || value.schemaVersion !== 1 || !object(value.records)) return state;
    for (const [id,r] of Object.entries(value.records)) if (unitId(id) && validRecord(r)) state.records[id] = copy(r);
    return state;
  }
  function entry(state,id,at) {
    if (!unitId(id) || !timestamp(at)) throw Error('学以致用单元或时间无效。');
    if (!state.records[id]) state.records[id] = {fields:Object.fromEntries(FIELDS.map(k => [k,''])),checks:Object.fromEntries(FIELDS.map(k => [k,false])),updatedAt:at,submittedAt:null,lastSubmission:null};
    return state.records[id];
  }
  function touch(r,at) { r.updatedAt = at > r.updatedAt ? at : r.updatedAt; r.submittedAt = null; }
  function updateField(state,id,field,text,at) {
    if (!FIELDS.includes(field) || typeof text !== 'string' || text.length > 20000) throw Error('学以致用输入内容过长或字段无效。');
    const r = entry(state,id,at);
    if (r.fields[field] === text) return false;
    r.fields[field] = text; r.checks[field] = false; touch(r,at);
    return true;
  }
  function setCheck(state,id,field,value,at) {
    if (!FIELDS.includes(field) || typeof value !== 'boolean') throw Error('学以致用自查记录无效。');
    const r = entry(state,id,at);
    if (r.checks[field] === value) return false;
    r.checks[field] = value; touch(r,at);
    return true;
  }
  function submit(state,id,at) {
    const r = entry(state,id,at);
    if (!FIELDS.every(k => r.fields[k].trim())) throw Error('请先填写四项内容；可以从简短句子开始。');
    if (!FIELDS.every(k => r.checks[k])) throw Error('请先逐项完成四条自查，再提交作品记录。');
    r.updatedAt = at > r.updatedAt ? at : r.updatedAt;
    r.submittedAt = r.updatedAt;
    r.lastSubmission = {fields:copy(r.fields),checks:copy(r.checks),submittedAt:r.submittedAt};
    return r;
  }
  function merge(local,incoming,protectedIds = new Set()) {
    const result = normalize(local), next = normalize(incoming);
    for (const [id,r] of Object.entries(next.records)) {
      if (protectedIds.has(id)) continue;
      if (!result.records[id] || r.updatedAt > result.records[id].updatedAt) result.records[id] = copy(r);
    }
    return result;
  }
  function reconcile(local,incoming,baseline,edits = {}) {
    const result = normalize(local), next = normalize(incoming), base = normalize(baseline), conflicts = [];
    const empty = {fields:Object.fromEntries(FIELDS.map(k=>[k,''])),checks:Object.fromEntries(FIELDS.map(k=>[k,false]))};
    for (const [id,remote] of Object.entries(next.records)) {
      if (!result.records[id]) { result.records[id] = copy(remote); continue; }
      const own = result.records[id], before = base.records[id] || empty;
      const revoked = before.submittedAt != null && (own.submittedAt === null || remote.submittedAt === null);
      for (const field of FIELDS) {
        const anchor = edits[id]?.[field];
        const original = anchor ? anchor.text : before.fields[field];
        const originalCheck = anchor ? anchor.check : before.checks[field];
        const localText = own.fields[field], remoteText = remote.fields[field];
        const localChanged = !!anchor || localText !== original;
        // Our own latest successful write is the baseline, not a competing
        // edit. Keep the original anchor only for snapshots that diverge from
        // that baseline (for example a delayed, overwritten storage event).
        const remoteChanged = remoteText !== before.fields[field];
        // An older whole-record event can contain a concurrent field edit. Do
        // not erase a known nonempty value with an older empty snapshot; retain
        // two distinct nonempty variants for review instead of guessing.
        const older = !anchor && before.updatedAt && remote.updatedAt < before.updatedAt;
        const conflict = localText !== remoteText && ((localChanged && remoteChanged) || (older && localText && remoteText));
        if (conflict) {
          conflicts.push({unitId:id,field,base:original,local:localText,remote:remoteText,remoteCheck:remote.checks[field]});
          own.checks[field] = false;
        } else if (!localChanged && remoteChanged && !(older && localText && !remoteText)) {
          own.fields[field] = remoteText; own.checks[field] = remote.checks[field];
        } else if (localText === remoteText) {
          const localCheckChanged = !!anchor || own.checks[field] !== originalCheck;
          const remoteCheckChanged = remote.checks[field] !== before.checks[field];
          if (!localCheckChanged && remoteCheckChanged) own.checks[field] = remote.checks[field];
          else if (localCheckChanged && remoteCheckChanged) own.checks[field] = own.checks[field] && remote.checks[field];
        }
      }
      const snapshots = [own.lastSubmission,remote.lastSubmission].filter(Boolean).sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt) || JSON.stringify(a).localeCompare(JSON.stringify(b)));
      own.lastSubmission = snapshots.length ? copy(snapshots.at(-1)) : null;
      own.updatedAt = [own.updatedAt,remote.updatedAt,own.lastSubmission?.submittedAt || ''].sort().at(-1);
      const sameSubmission = own.lastSubmission && ready(own) && FIELDS.every(k=>own.fields[k]===own.lastSubmission.fields[k] && own.checks[k]===own.lastSubmission.checks[k]);
      const submitted = [own.submittedAt,remote.submittedAt].includes(own.lastSubmission?.submittedAt);
      own.submittedAt = sameSubmission && submitted && !revoked && !conflicts.some(c=>c.unitId===id) ? own.lastSubmission.submittedAt : null;
    }
    validate(result);
    return {state:result,conflicts};
  }
  function wordCount(text) { return (String(text).match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length; }
  const api = {createState,normalize,validate,updateField,setCheck,submit,merge,reconcile,wordCount,fields:Object.freeze(FIELDS.slice())};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LiteracyCore = api;
})(typeof window === 'undefined' ? globalThis : window);
