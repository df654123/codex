// Personal-device offline outbox. Never holds passwords, cookies, or tokens.
const NAME = 'class4-offline-scores-v1';
let opening;
function store() {
  if (!opening) opening = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('浏览器不支持离线数据库'));
    const q = indexedDB.open(NAME, 1);
    q.onupgradeneeded = () => {
      const table = q.result.createObjectStore('actions', { keyPath: 'id' });
      table.createIndex('scope', 'scope', { unique: false });
    };
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => { opening = null; reject(q.error || new Error('离线数据库打开失败')); };
    q.onblocked = () => { opening = null; reject(new Error('请关闭其他工作台页面后重试')); };
  });
  return opening;
}
export async function putPending(item) {
  if (!item?.id || !item?.scope || !item?.payload)
    throw new Error('待传操作缺少必要信息');
  const db = await store();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('actions', 'readwrite');
    const table = tx.objectStore('actions');
    const q = table.get(item.id);
    q.onsuccess = () => {
      const old = q.result;
      if (old && JSON.stringify(old.payload) !== JSON.stringify(item.payload)) {
        tx.abort();
        return;
      }
      table.put(old || { ...item, createdAt: new Date().toISOString() });
    };
    tx.oncomplete = () => resolve(item.id);
    tx.onabort = tx.onerror = () => reject(new Error('离线记录未保存；请勿关闭页面'));
  });
}
export async function listPending(scope) {
  const db = await store();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('actions', 'readonly');
    const q = tx.objectStore('actions').index('scope').getAll(scope);
    q.onsuccess = () => resolve(q.result.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    q.onerror = () => reject(q.error);
  });
}
export async function removePending(id) {
  const db = await store();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('actions', 'readwrite');
    tx.objectStore('actions').delete(id);
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}
