import { eq, and, sql, desc } from 'drizzle-orm'
import { scoreLogs, users } from '../../database/schema'
import { useSchoolDb } from '../../database/db'
import { getStudentFromSession } from '../../utils/auth'

// GET /api/student/logs — 获取当前学生的积分记录（学生端专用）
export default defineEventHandler(async (event) => {
  const student = await getStudentFromSession(event)
  if (!student) {
    setResponseStatus(event, 401)
    return { success: false, message: '请先登录' }
  }

  const db = await useSchoolDb(event, student.schoolId)

  const query = getQuery(event) as {
    date?: string
    page?: string
    limit?: string
  }

  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit
  const date = (query.date || '').trim()

  // 学生只能看自己的记录
  const conditions = [eq(scoreLogs.userId, student.id)]
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw createError({ statusCode: 400, message: '日期格式必须为YYYY-MM-DD' })
    const start = new Date(`${date}T00:00:00+08:00`)
    if (!Number.isFinite(start.getTime()) || new Date(start.getTime() + 8 * 3600000).toISOString().slice(0, 10) !== date)
      throw createError({ statusCode: 400, message: '日期不合法' })
    const from = start.toISOString()
    const to = new Date(start.getTime() + 86400000).toISOString()
    conditions.push(sql`${scoreLogs.createdAt} >= ${from} and ${scoreLogs.createdAt} < ${to}`)
  }

  const whereClause = and(...conditions)

  const logs = await db
    .select({
      id: scoreLogs.id,
      userId: scoreLogs.userId,
      username: users.username,
      scoreChange: scoreLogs.scoreChange,
      description: scoreLogs.description,
      createdAt: scoreLogs.createdAt,
    })
    .from(scoreLogs)
    .leftJoin(users, eq(scoreLogs.userId, users.id))
    .where(whereClause)
    .orderBy(desc(scoreLogs.createdAt))
    .limit(limit)
    .offset(offset)

  const totalRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(scoreLogs)
    .where(whereClause)
    .get()

  const total = (totalRes as any)?.count || 0

  return {
    success: true,
    data: logs,
    total,
    page,
    limit,
  }
})
