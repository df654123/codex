(function (root) {
  'use strict';
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const unitId = value => typeof value === 'string' && /^[789][ab]-u[1-9]\d{0,2}$/.test(value);
  const validKey = value => typeof value === 'string' && /^[789][ab]-u[1-9]\d{0,2}::(?:0|[1-9]\d{0,2})$/.test(value);
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const timestamp = value => typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value));
  function dayKey(value = new Date()) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  const dateKey = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dayKey(value + 'T04:00:00Z') === value;
  const validRecord = value => object(value) && Number.isInteger(value.level) && value.level >= 0 && value.level <= 4 && dateKey(value.due) && timestamp(value.at) && ['remembered','hard','spellingCorrect','spellingWrong'].every(field => count(value[field]));
  const copyRecord = value => ({level:value.level,due:value.due,at:value.at,remembered:value.remembered,hard:value.hard,spellingCorrect:value.spellingCorrect,spellingWrong:value.spellingWrong});
  function normalize(value) {
    const state = object(value) && (value.version === undefined || value.version === 1) ? value : {};
    return {version:1, records:Object.fromEntries(Object.entries(object(state.records) ? state.records : {}).filter(([key, record]) => validKey(key) && validRecord(record)).map(([key, record]) => [key, copyRecord(record)]))};
  }
  function validate(value) {
    if (!object(value) || value.version !== 1 || !object(value.records) || Object.entries(value.records).some(([key, record]) => !validKey(key) || !validRecord(record))) {
      throw Error('背单词记录格式损坏，请选择本站导出的完整备份。');
    }
    return true;
  }
  function key(id, index) {
    if (!unitId(id) || !Number.isInteger(index) || index < 0 || index > 999) throw Error('无效的单元或单词位置。');
    const word = root.ENGLISH_CURRICULUM?.units?.find(unit => unit.id === id)?.vocabulary?.[index];
    const reviewId = word?.reviewId;
    if (reviewId !== undefined && (!Number.isInteger(reviewId) || reviewId < 0 || reviewId > 999)) throw Error('无效的单词复习身份。');
    // Initial IDs match v3.7 positions, so existing numeric records need no rewrite.
    // Later content changes keep these IDs instead of inheriting a different word's history.
    return id + '::' + (reviewId === undefined ? index : reviewId);
  }
  function createCard(id, index) {
    key(id, index);
    return {unitId:id,index,revealed:false,rated:false,checked:false,input:'',result:null,rating:null};
  }
  function reveal(card) { card.revealed = true; }
  const add = value => Math.min(Number.MAX_SAFE_INTEGER, value + 1);
  function currentRecord(state, card, at) {
    const recordKey = key(card.unitId, card.index);
    if (!validRecord(state.records[recordKey])) state.records[recordKey] = {level:0,due:dayKey(at),at:new Date(at).toISOString(),remembered:0,hard:0,spellingCorrect:0,spellingWrong:0};
    return state.records[recordKey];
  }
  function evaluate(state, card, rating, at = new Date()) {
    if (!card.revealed || card.rated || !['remembered','hard'].includes(rating) || !dayKey(at)) return false;
    const record = currentRecord(state, card, at);
    if (rating === 'remembered') {
      record.remembered = add(record.remembered);
      const day = dayKey(at);
      if (record.level === 0 || record.due <= day) {
        record.level = Math.min(4, record.level + 1);
        const days = [1,3,7,14][record.level - 1];
        record.due = new Date(Date.parse(day + 'T00:00:00Z') + days * 86400000).toISOString().slice(0,10);
      }
    } else {
      record.level = 0; record.hard = add(record.hard); record.due = dayKey(at);
    }
    record.at = new Date(at).toISOString();
    card.rated = true; card.rating = rating;
    return true;
  }
  const spelling = text => String(text).trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
  function checkSpelling(state, card, input, answer, at = new Date()) {
    if (card.checked || typeof input !== 'string' || !input.trim() || typeof answer !== 'string' || !answer.trim() || !dayKey(at)) return null;
    const correct = spelling(input) === spelling(answer);
    const record = currentRecord(state, card, at);
    const field = correct ? 'spellingCorrect' : 'spellingWrong';
    record[field] = add(record[field]); record.at = new Date(at).toISOString();
    card.checked = true; card.input = input.trim();
    card.result = {correct,answer,input:card.input};
    return {...card.result};
  }
  function filterWords(state, unit, filter = 'all', today = dayKey()) {
    return unit.vocabulary.map((word, index) => index).filter(index => {
      const record = state.records[key(unit.id, index)];
      if (filter === 'new') return !record || record.level === 0;
      if (filter === 'due') return !record || record.due <= today;
      return true;
    });
  }
  function stats(state, unit, today = dayKey()) {
    const records = unit.vocabulary.map((word, index) => state.records[key(unit.id,index)]);
    const reviewed = records.filter(record => record && record.remembered + record.hard > 0).length;
    const sum = field => records.reduce((total, record) => total + (record?.[field] || 0), 0);
    return {total:records.length,reviewed,remembered:records.filter(record => record?.level > 0).length,needsWork:filterWords(state,unit,'new',today).length,due:filterWords(state,unit,'due',today).length,percent:records.length ? Math.round(reviewed / records.length * 100) : 0,oralRemembered:sum('remembered'),oralHard:sum('hard'),spellingCorrect:sum('spellingCorrect'),spellingWrong:sum('spellingWrong')};
  }
  const api = {normalize,validate,key,dayKey,createCard,reveal,evaluate,checkSpelling,filterWords,stats};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WordStudyCore = api;
})(typeof window === 'undefined' ? globalThis : window);
