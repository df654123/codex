import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { apiIdempotency } from '../database/schema.school'

// A teacher action has a stable ID. The receipt and all score writes commit together.
export async function withTeacherScoreIntent(opts: {
  db: any
  adminId: number
  operationId: string | undefined
  intent: unknown
  run: (transaction: any) => Promise<any>
}) {
  const { db, adminId, operationId, intent, run } = opts
  if (typeof operationId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(operationId)) {
    throw createError({ statusCode: 400, message: '缺少有效操作编号，请刷新至最新版本后重试' })
  }
  const tokenId = -Number(adminId)
  const key = operationId
  const digest = createHash('sha256').update(JSON.stringify(intent)).digest('hex')
  const endpoint = 'POST /api/scores/add:' + digest
  const where = and(eq(apiIdempotency.tokenId, tokenId), eq(apiIdempotency.key, key))
  const replay = (record: any) => {
    if (record.endpoint !== endpoint) {
      throw createError({ statusCode: 409, message: '同一操作编号对应不同内容，请核对输入' })
    }
    try { return JSON.parse(record.responseJson) } catch {
      throw createError({ statusCode: 409, message: '操作回执无效，已拒绝重复记账' })
    }
  }
  const previous = await db.select().from(apiIdempotency).where(where).get()
  if (previous) return replay(previous)
  try {
    return await db.transaction(async (tx: any) => {
      const concurrent = await tx.select().from(apiIdempotency).where(where).get()
      if (concurrent) return replay(concurrent)
      const result = await run(tx)
      await tx.insert(apiIdempotency).values({
        tokenId, key, endpoint, responseJson: JSON.stringify(result),
      })
      return result
    })
  } catch (error) {
    // A timeout or concurrent duplicate may mean the first request already committed.
    const saved = await db.select().from(apiIdempotency).where(where).get()
    if (saved) return replay(saved)
    throw error
  }
}
