// 通用的数据库 dump / restore（基于 libsql raw client）
// 用于「整机备份」与「按范围备份/恢复」：把每个 db 的所有用户表序列化为 JSON，
// 恢复时清空并重新插入（关闭外键约束，对 schema 差异（多余/缺失列）保持容错）。

/** 列出 db 中的用户表（排除 sqlite 内部表） */
async function listTables(client: any): Promise<string[]> {
  const res = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  )
  return (res.rows as any[]).map((r) => r.name as string)
}

/** 获取表的列名（按定义顺序） */
async function tableColumns(client: any, table: string): Promise<string[]> {
  const res = await client.execute(`PRAGMA table_info(${table})`)
  return (res.rows as any[]).map((r) => r.name as string)
}

export interface DumpedTable {
  table: string
  columns: string[]
  rows: Record<string, any>[]
}

/** 导出某个 db 的所有表 */
export async function dumpDb(client: any): Promise<DumpedTable[]> {
  const tables = await listTables(client)
  const dumped: DumpedTable[] = []
  for (const t of tables) {
    const cols = await tableColumns(client, t)
    const res = await client.execute(`SELECT * FROM ${t}`)
    const rows = (res.rows as any[]).map((r) => {
      const o: Record<string, any> = {}
      for (const c of cols) o[c] = (r as any)[c]
      return o
    })
    dumped.push({ table: t, columns: cols, rows })
  }
  return dumped
}

/** 恢复某个 db：清空并插入（仅处理已存在的表，忽略 schema 差异列） */
export async function restoreDb(
  client: any,
  tables: { table: string; columns?: string[]; rows?: Record<string, any>[] }[],
): Promise<{ tables: number; rows: number }> {
  // Class4: reject invalid/unrecognized schema before any destructive write.
  if (!Array.isArray(tables) || tables.length > 250) throw new Error('无效备份结构')
  const known = new Set(await listTables(client))
  const seen = new Set<string>()
  for (const item of tables) {
    if (!item || typeof item.table !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.table)
      || seen.has(item.table) || !known.has(item.table)
      || !Array.isArray(item.columns) || !Array.isArray(item.rows))
      throw new Error('备份包含重复、未知或格式错误的表')
    seen.add(item.table)
    const cols = new Set(await tableColumns(client, item.table))
    if (!item.columns.every(c => typeof c === 'string'
      && /^[A-Za-z_][A-Za-z0-9_]*$/.test(c) && cols.has(c)))
      throw new Error('备份列名与当前数据库不匹配')
  }
  // SQLite foreign-key pragmas must be changed outside a transaction.
  await client.execute('PRAGMA foreign_keys = OFF')
  let tx: any
  let tableCount = 0
  let rowCount = 0
  try {
    tx = await client.transaction('write')
    for (const item of tables) {
      const columns = item.columns || []
      if (!columns.length) continue
      const tableName = '"' + item.table + '"'
      await tx.execute('DELETE FROM ' + tableName)
      tableCount++
      const statement = 'INSERT INTO ' + tableName + ' (' + columns.map(c => '"' + c + '"').join(', ')
        + ') VALUES (' + columns.map(() => '?').join(', ') + ')'
      for (const row of item.rows || []) {
        await tx.execute({ sql: statement, args: columns.map(c => row[c] ?? null) })
        rowCount++
      }
    }
    const errors = await tx.execute('PRAGMA foreign_key_check')
    if (errors.rows.length) throw new Error('备份恢复存在无效引用，已回滚')
    await tx.commit()
    return { tables: tableCount, rows: rowCount }
  } catch (e) {
    if (tx) try { await tx.rollback() } catch { /* retain primary error */ }
    throw e
  } finally {
    await client.execute('PRAGMA foreign_keys = ON')
  }
}
