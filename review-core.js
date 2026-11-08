/* WordMemoryCore: local FSRS-6 review records. See docs/open-source-20261030.md. */
(function (root, factory) {
  'use strict';
  const library = typeof module !== 'undefined' && module.exports
    ? require('./vendor/ts-fsrs-5.4.2.umd.js')
    : (root.FSRS || globalThis.FSRS);
  const policy = typeof module !== 'undefined' && module.exports ? require('./spelling-policy.js') : root.SpellingPolicy;
  const api = factory(library,policy);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WordMemoryCore = api;
})(typeof window === 'undefined' ? globalThis : window, function (FSRS,policy) {
  'use strict';
  if (!FSRS || typeof FSRS.fsrs !== 'function' || !String(FSRS.FSRSVersion).includes('5.4.2')) {
    throw Error('复习引擎未加载：请先加载本站固定的 ts-fsrs 5.4.2 文件。');
  }
  const MODES = ['meaning', 'spelling'];
  const MAX_CARDS = 10000;
  const MAX_LOGS = 250000;
  const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const plain = value => {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === null || Object.getPrototypeOf(proto) === null;
  };
  const fail = message => { throw Error('复习记录：' + message); };
  const ordered = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const eventOrder = (a, b) => ordered(a.at, b.at) || ordered(a.id, b.id);
  const engine = FSRS.fsrs({
    request_retention: 0.9, maximum_interval: 36500, enable_fuzz: false,
    enable_short_term: true, learning_steps: ['1m', '10m'], relearning_steps: ['10m']
  });

  function iso(value, label = '时间') {
    let time;
    if (Object.prototype.toString.call(value) === '[object Date]') {
      time = Date.prototype.getTime.call(value);
    } else if (typeof value === 'string') {
      const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
      if (!parts) fail(label + '必须为有效的完整日期时间。');
      const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number);
      const calendar = new Date(Date.UTC(year, month - 1, day));
      if (year < 1970 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 ||
          calendar.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59 ||
          (parts[8] !== 'Z' && (Number(parts[8].slice(1, 3)) > 23 || Number(parts[8].slice(4)) > 59))) {
        fail(label + '不合法。');
      }
      time = Date.parse(value);
    }
    if (!Number.isFinite(time) || time < 0 || time > 253402300799999) fail(label + '不合法。');
    return new Date(time).toISOString();
  }
  const nowISO = value => iso(value === undefined ? new Date() : value);
  const day = value => new Date(Date.parse(iso(value)) + 8 * 3600000).toISOString().slice(0, 10);
  function safeClone(value, stack = new Set(), depth = 0) {
    if (depth > 15) fail('数据层级过深。');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Object.prototype.toString.call(value) === '[object Date]') return iso(value);
    if (!Array.isArray(value) && !plain(value)) fail('包含无法保存的数据。');
    if (stack.has(value)) fail('包含循环引用。');
    if (Array.isArray(value) && value.length > MAX_LOGS) fail('记录过多。');
    stack.add(value);
    const result = Array.isArray(value) ? [] : {};
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue;
      if (typeof key !== 'string' || RESERVED.has(key)) fail('包含危险键名。');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !own(descriptor, 'value')) fail('不接受动态属性。');
      if (descriptor.value === undefined) continue;
      result[key] = safeClone(descriptor.value, stack, depth + 1);
    }
    stack.delete(value);
    return result;
  }
  function fields(value, allowed, required = allowed) {
    if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !own(value, key))) {
      fail('备份字段不完整或包含未知字段。');
    }
  }
  function text(value, label, max, optional = false) {
    if (optional && (value === undefined || value === null)) return '';
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(label + '格式或长度不合法。');
    const result = value.trim();
    if (!optional && !result) fail(label + '不能为空。');
    return result;
  }
  function unit(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !/^[789][ab]-u[1-9]\d{0,2}$/.test(value)) fail('单元标识不合法。');
    return value;
  }
  function mode(value = 'meaning') {
    if (!MODES.includes(value)) fail('练习方式不合法。');
    return value;
  }
  function integer(value, label, max = Number.MAX_SAFE_INTEGER) {
    if (!Number.isSafeInteger(value) || value < 0 || value > max) fail(label + '不合法。');
    return value;
  }
  function finite(value, label, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(label + '不合法。');
    return value;
  }
  function spelling(value) {
    return typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ') : '';
  }
  function checkSpelling(input, word) {
    const actual = spelling(input), expected = spelling(word);
    return policy ? policy.compare(input,word).correct : !!actual && !!expected && actual === expected;
  }
  function wordFields(value) {
    if (!plain(value)) fail('词条格式不合法。');
    const word = text(value.word, '英文词语', 160);
    if (!/[a-z]/i.test(word) || /[<>]/.test(word)) fail('英文词语格式不合法。');
    return {word, meaning: text(value.meaning, '词义', 600), example: text(value.example, '例句', 2000, true), unitId: unit(value.unitId)};
  }
  function cardID(value) {
    if (typeof value !== 'string' || !/^(?:unit:[789][ab]-u[1-9]\d{0,2}:(?:0|[1-9]\d{0,5})|custom:[0-9a-f]{16})$/.test(value)) fail('词条身份标识不合法。');
    return value;
  }
  function eventID(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/.test(value) || RESERVED.has(value)) fail('事件标识不合法。');
    return value;
  }
  function descriptor(value) {
    const input = safeClone(value);
    fields(input, ['id', 'word', 'meaning', 'example', 'unitId', 'origin'], ['id', 'word', 'meaning', 'origin']);
    const word = wordFields(input), id = cardID(input.id);
    if (!['curriculum', 'custom'].includes(input.origin) ||
        (input.origin === 'curriculum' && (!word.unitId || !id.startsWith('unit:' + word.unitId + ':'))) ||
        (input.origin === 'custom' && !id.startsWith('custom:'))) fail('词条来源与身份不匹配。');
    return {id, ...word, origin: input.origin};
  }
  const schedulerKeys = ['due', 'stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses', 'state', 'last_review'];
  function schedulerDTO(value) {
    fields(value, schedulerKeys, schedulerKeys.filter(key => key !== 'last_review'));
    const out = {
      due: iso(value.due, '到期时间'), stability: finite(value.stability, '稳定性', 0, 1000000),
      difficulty: finite(value.difficulty, '难度', 0, 10), elapsed_days: integer(value.elapsed_days, '间隔天数', 3650000),
      scheduled_days: integer(value.scheduled_days, '计划天数', 36500), learning_steps: integer(value.learning_steps, '学习步骤', 1000),
      reps: integer(value.reps, '复习次数', MAX_LOGS), lapses: integer(value.lapses, '遗忘次数', MAX_LOGS),
      state: integer(value.state, '卡片状态', 3), last_review: value.last_review == null ? null : iso(value.last_review, '上次复习时间')
    };
    if (out.lapses > out.reps || (out.reps === 0 && (out.state !== 0 || out.last_review !== null || out.stability !== 0 || out.difficulty !== 0)) ||
        (out.reps > 0 && (out.state === 0 || !out.last_review || out.stability <= 0 || out.difficulty < 1 || out.due < out.last_review))) {
      fail('卡片状态与复习次数不一致。');
    }
    return out;
  }
  const logKeys = ['rating', 'state', 'due', 'stability', 'difficulty', 'elapsed_days', 'last_elapsed_days', 'scheduled_days', 'learning_steps', 'review'];
  function reviewLogDTO(value) {
    fields(value, logKeys);
    const result = {
      rating: integer(value.rating, '评级', 4), state: integer(value.state, '日志状态', 3), due: iso(value.due, '日志前次时间'),
      stability: finite(value.stability, '日志稳定性', 0, 1000000), difficulty: finite(value.difficulty, '日志难度', 0, 10),
      elapsed_days: integer(value.elapsed_days, '日志间隔', 3650000), last_elapsed_days: integer(value.last_elapsed_days, '日志前次间隔', 3650000),
      scheduled_days: integer(value.scheduled_days, '日志计划天数', 36500), learning_steps: integer(value.learning_steps, '日志步骤', 1000),
      review: iso(value.review, '实际复习时间')
    };
    if (result.rating < 1 || result.due > result.review) fail('日志评级或时间不合法。');
    return result;
  }
  function hydrate(value) {
    const card = {...value, due: new Date(value.due)};
    if (value.last_review) card.last_review = new Date(value.last_review);
    else delete card.last_review;
    return card;
  }
  function newSchedule(at) { return schedulerDTO(FSRS.createEmptyCard(new Date(at))); }
  function createState() {
    return {schemaVersion:1, schedulerPackageVersion:'5.4.2', modelVersion:'FSRS-6', migratedLegacy:false, cards:{}, logs:[]};
  }
  function normalizeRecord(value, id) {
    fields(value, ['id', 'word', 'meaning', 'example', 'unitId', 'origin', 'createdAt', 'updatedAt', 'schedulers']);
    const desc = descriptor({id:value.id, word:value.word, meaning:value.meaning, example:value.example, unitId:value.unitId, origin:value.origin});
    if (desc.id !== id) fail('词条键与身份不一致。');
    fields(value.schedulers, MODES);
    const result = {...desc, createdAt:iso(value.createdAt), updatedAt:iso(value.updatedAt), schedulers:{
      meaning:schedulerDTO(value.schedulers.meaning), spelling:schedulerDTO(value.schedulers.spelling)
    }};
    if (result.createdAt > result.updatedAt) fail('词条创建时间晚于更新时间。');
    return result;
  }
  function normalizeLog(value) {
    fields(value, ['id', 'cardId', 'at', 'mode', 'rating', 'answer', 'correct', 'reviewLog']);
    const result = {
      id:eventID(value.id), cardId:cardID(value.cardId), at:iso(value.at), mode:mode(value.mode),
      rating:integer(value.rating, '评级', 4), answer:value.answer === null ? null : text(value.answer, '作答', 1000, true),
      correct:value.correct, reviewLog:reviewLogDTO(value.reviewLog)
    };
    if (result.rating < 1 || ![true, false, null].includes(result.correct) || result.reviewLog.rating !== result.rating || result.reviewLog.review !== result.at) {
      fail('事件与原始调度日志不一致。');
    }
    if (result.mode === 'spelling' && (!result.answer || result.correct === null || (!result.correct && result.rating !== 1))) fail('拼写事件缺少有效作答或评级。');
    return result;
  }
  function validate(value) {
    const input = safeClone(value);
    fields(input, ['schemaVersion', 'schedulerPackageVersion', 'modelVersion', 'migratedLegacy', 'cards', 'logs']);
    if (input.schemaVersion !== 1 || input.schedulerPackageVersion !== '5.4.2' || input.modelVersion !== 'FSRS-6' ||
        typeof input.migratedLegacy !== 'boolean' || !plain(input.cards) || !Array.isArray(input.logs) ||
        Object.keys(input.cards).length > MAX_CARDS || input.logs.length > MAX_LOGS) fail('备份版本或大小不受支持。');
    const result = createState(); result.migratedLegacy = input.migratedLegacy;
    const counts = new Map(), latest = new Map(), seen = new Set();
    for (const id of Object.keys(input.cards).sort(ordered)) result.cards[cardID(id)] = normalizeRecord(input.cards[id], id);
    for (const raw of input.logs) {
      const log = normalizeLog(raw), card = result.cards[log.cardId];
      if (!card || seen.has(log.id) || log.at < card.createdAt || log.at > card.updatedAt ||
          (log.mode === 'spelling' && log.correct !== checkSpelling(log.answer, card.word))) fail('日志重复、缺少词条或时间/作答不一致。');
      seen.add(log.id);
      const key = log.cardId + '/' + log.mode;
      counts.set(key, (counts.get(key) || 0) + 1);
      latest.set(key, !latest.has(key) || latest.get(key) < log.at ? log.at : latest.get(key));
      result.logs.push(log);
    }
    result.logs.sort(eventOrder);
    for (const card of Object.values(result.cards)) for (const kind of MODES) {
      const schedule = card.schedulers[kind], key = card.id + '/' + kind;
      if (schedule.reps !== (counts.get(key) || 0) || schedule.last_review !== (latest.get(key) || null) ||
          (schedule.reps === 0 && schedule.due !== card.createdAt)) fail('卡片与完整复习历史不一致。');
    }
    return result;
  }
  function normalize(value) { return value == null ? createState() : validate(value); }
  function commit(target, source) {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, source);
  }
  function catalog(curriculumData) {
    if (!plain(curriculumData) || !Array.isArray(curriculumData.units)) fail('教材目录不合法。');
    const result = [], seen = new Set();
    for (const section of curriculumData.units) {
      const unitId = unit(section.id);
      if (!unitId || !Array.isArray(section.vocabulary)) fail('教材单元不合法。');
      for (const entry of section.vocabulary) {
        const reviewId = integer(entry.reviewId, '永久 reviewId 身份', 999999);
        const row = descriptor({id:'unit:' + unitId + ':' + reviewId, unitId, word:entry.word, meaning:entry.meaning, example:entry.example || '', origin:'curriculum'});
        if (seen.has(row.id)) fail('教材 reviewId 身份重复。');
        seen.add(row.id); result.push(row);
      }
    }
    return result;
  }
  function compatible(a, b) {
    return a.origin === b.origin && a.unitId === b.unitId && spelling(a.word) === spelling(b.word) &&
      (a.origin !== 'custom' || a.meaning === b.meaning);
  }
  function addWords(state, words, now) {
    const draft = validate(state), at = nowISO(now);
    if (!Array.isArray(words) || words.length > MAX_CARDS) fail('词条批次不合法。');
    const rows = words.map(descriptor);
    let added = 0, existing = 0;
    for (const row of rows) {
      if (own(draft.cards, row.id)) {
        if (!compatible(draft.cards[row.id], row)) fail('同一词条身份指向不同内容。');
        existing++; continue;
      }
      draft.cards[row.id] = {...row, createdAt:at, updatedAt:at, schedulers:{meaning:newSchedule(at), spelling:newSchedule(at)}};
      added++;
    }
    if (Object.keys(draft.cards).length > MAX_CARDS) fail('词条总数超过上限。');
    commit(state, draft);
    return {added, existing};
  }
  function syncCatalog(state, rows) {
    for (const row of rows) {
      const card=state.cards[row.id];
      if(card && card.origin==='curriculum' && compatible(card,row)){card.meaning=row.meaning;card.example=row.example;}
    }
    return state;
  }
  function customIdentity(row) {
    const source = JSON.stringify([row.unitId, spelling(row.word), row.meaning]);
    let a = 2166136261, b = 5381;
    for (let i = 0; i < source.length; i++) {
      a = Math.imul(a ^ source.charCodeAt(i), 16777619) >>> 0;
      b = (Math.imul(b, 33) ^ source.charCodeAt(i)) >>> 0;
    }
    return 'custom:' + a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  }
  function addCustom(state, value, now) {
    const input = safeClone(value);
    fields(input, ['word', 'meaning', 'example', 'unitId'], ['word', 'meaning']);
    const row = wordFields(input), id = customIdentity(row);
    addWords(state, [{id, ...row, origin:'custom'}], now);
    return id;
  }
  function parseImport(value) {
    if (typeof value !== 'string' || value.length > 600000) fail('导入文本过大或格式不合法。');
    const lines = value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').filter(line => line.trim());
    if (!lines.length || lines.length > 200) fail('每批请输入 1 至 200 行词条。');
    return lines.map((line, index) => {
      const parts = line.split('\t');
      if (parts.length < 2 || parts.length > 3) fail('第 ' + (index + 1) + ' 行必须使用制表符分隔英文、词义和可选例句。');
      const row = wordFields({word:parts[0], meaning:parts[1], example:parts[2] || ''});
      return {word:row.word, meaning:row.meaning, example:row.example};
    });
  }
  function migrateLegacy(state, legacyWordStudy, curriculumData, now) {
    const draft = validate(state), at = nowISO(now);
    if (draft.migratedLegacy) return {added:0};
    const legacy = legacyWordStudy == null ? {} : safeClone(legacyWordStudy);
    const records = plain(legacy.records) ? legacy.records : {};
    const counts = ['remembered', 'hard', 'spellingCorrect', 'spellingWrong'];
    const rows = catalog(curriculumData).filter(row => {
      const record = records[row.unitId + '::' + row.id.split(':').pop()];
      return plain(record) && counts.every(key => Number.isSafeInteger(record[key]) && record[key] >= 0) && counts.some(key => record[key] > 0);
    });
    const result = addWords(draft, rows, at);
    draft.migratedLegacy = true; commit(state, draft);
    return {added:result.added};
  }
  function queue(state, options = {}) {
    const current = validate(state), at = nowISO(options.now), kind = mode(options.mode);
    const unitId = unit(options.unitId), limit = options.limit === undefined ? 20 : integer(options.limit, '本轮上限', 1000);
    const newLimit = options.newLimit === undefined ? 5 : integer(options.newLimit, '每日新词上限', 1000);
    const first = new Map();
    for (const log of current.logs) if (log.mode === kind && !first.has(log.cardId)) first.set(log.cardId, log.at);
    const used = Array.from(first.values()).filter(time => day(time) === day(at)).length;
    const available = Math.max(0, newLimit - used);
    const selected = Object.values(current.cards).filter(card => !unitId || card.unitId === unitId);
    const due = selected.filter(card => card.schedulers[kind].reps > 0 && card.schedulers[kind].due <= at)
      .sort((a, b) => ordered(a.schedulers[kind].due, b.schedulers[kind].due) || ordered(a.id, b.id));
    const fresh = selected.filter(card => card.schedulers[kind].reps === 0 && card.createdAt <= at)
      .sort((a, b) => ordered(a.createdAt, b.createdAt) || ordered(a.id, b.id)).slice(0, available);
    return due.concat(fresh).slice(0, limit).map(card => card.id);
  }
  function replay(card, kind, logs) {
    let schedule = newSchedule(card.createdAt);
    for (const log of logs) if (log.cardId === card.id && log.mode === kind) {
      schedule = schedulerDTO(engine.next(hydrate(schedule), new Date(log.at), log.rating).card);
    }
    return schedule;
  }
  function sameEvent(a, b, includeTime = true) {
    return a.cardId === b.cardId && a.mode === b.mode && a.rating === b.rating && a.answer === b.answer && a.correct === b.correct &&
      (!includeTime || a.at === b.at);
  }
  function review(state, id, rating, now, meta = {}) {
    const draft = validate(state), kind = mode(meta.mode), eventId = eventID(meta.eventId);
    const card = draft.cards[cardID(id)];
    if (!card) fail('词条尚未加入复习计划。');
    if (!Number.isInteger(rating) || rating < 1 || rating > 4) fail('评级只能为 Again、Hard、Good 或 Easy。');
    let answer = meta.answer == null ? null : text(meta.answer, '作答', 1000, true);
    let correct = meta.correct == null ? null : meta.correct;
    if (![true, false, null].includes(correct)) fail('作答结果格式不合法。');
    if (kind === 'spelling') {
      if (!answer) fail('请先输入拼写答案。');
      const actual = checkSpelling(answer, card.word);
      if (correct !== null && correct !== actual) fail('拼写结果与答案不一致。');
      correct = actual;
      if (!correct && rating !== 1) fail('拼写错误应使用 Again 重新学习。');
    }
    const candidate = {cardId:id, mode:kind, rating, answer, correct};
    const previous = draft.logs.find(log => log.id === eventId);
    if (previous) {
      if (!sameEvent(previous, candidate, false)) fail('同一事件标识发生冲突，请保留当前记录。');
      return {applied:false, card:safeClone(card), due:card.schedulers[kind].due, log:safeClone(previous)};
    }
    const at = nowISO(now), before = card.schedulers[kind];
    if (at < card.createdAt || (before.last_review && at < before.last_review)) fail('复习时间早于已有记录，请检查设备时间。');
    if (draft.logs.length >= MAX_LOGS) fail('复习记录已达到上限，请先导出备份。');
    const outcome = engine.next(hydrate(before), new Date(at), rating);
    const log = normalizeLog({id:eventId, ...candidate, at, reviewLog:reviewLogDTO(outcome.log)});
    draft.logs.push(log); draft.logs.sort(eventOrder);
    card.updatedAt = ordered(card.updatedAt, at) < 0 ? at : card.updatedAt;
    // Equal-time events have a stable order; keep each event's original log intact.
    card.schedulers[kind] = replay(card, kind, draft.logs);
    commit(state, draft);
    return {applied:true, card:safeClone(card), due:card.schedulers[kind].due, log:safeClone(log)};
  }
  function stats(state, now, selectedMode = 'meaning') {
    const current = validate(state), at = nowISO(now), kind = mode(selectedMode), today = day(at);
    const cards = Object.values(current.cards), logs = current.logs.filter(log => log.mode === kind);
    const spellingLogs = current.logs.filter(log => log.mode === 'spelling');
    return {
      total:cards.length, due:cards.filter(card => card.schedulers[kind].reps > 0 && card.schedulers[kind].due <= at).length,
      new:cards.filter(card => card.schedulers[kind].reps === 0).length,
      reviewedToday:logs.filter(log => day(log.at) === today).length, reviewedWords:new Set(logs.map(log => log.cardId)).size,
      spellingCorrect:spellingLogs.filter(log => log.correct).length, spellingAttempts:spellingLogs.length
    };
  }
  function merge(local, remote) {
    const left = normalize(local), right = normalize(remote), result = createState();
    result.migratedLegacy = left.migratedLegacy || right.migratedLegacy;
    for (const id of Array.from(new Set([...Object.keys(left.cards), ...Object.keys(right.cards)])).sort(ordered)) {
      const a = left.cards[id], b = right.cards[id];
      if (a && b && !compatible(a, b)) fail('同一词条身份发生内容冲突，请保留两份备份。');
      const chosen = !a ? b : !b ? a : (ordered(a.updatedAt, b.updatedAt) || ordered(JSON.stringify(a), JSON.stringify(b))) >= 0 ? a : b;
      const card = safeClone(chosen);
      if (a && b) {
        card.createdAt = a.createdAt < b.createdAt ? a.createdAt : b.createdAt;
        card.updatedAt = a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt;
      }
      result.cards[id] = card;
    }
    const events = new Map();
    for (const event of left.logs.concat(right.logs)) {
      const existing = events.get(event.id);
      if (existing && (!sameEvent(existing, event) || JSON.stringify(existing.reviewLog) !== JSON.stringify(event.reviewLog))) {
        fail('同一事件标识发生冲突，请保留两份备份。');
      }
      if (!existing) events.set(event.id, safeClone(event));
    }
    result.logs = Array.from(events.values()).sort(eventOrder);
    for (const card of Object.values(result.cards)) for (const kind of MODES) card.schedulers[kind] = replay(card, kind, result.logs);
    return validate(result);
  }
  return Object.freeze({createState, normalize, validate, catalog, syncCatalog, addWords, addCustom, parseImport, migrateLegacy, queue, review, checkSpelling, stats, merge});
});
