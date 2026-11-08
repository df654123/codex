import { and, eq, inArray, sql } from 'drizzle-orm'
import { scoreLogs, users } from '../../database/schema.school'
import { useSchoolDb } from '../../database/db'
import { requireAdmin, getSchoolIdFromRequest, resolveSchoolScope } from '../../utils/auth'

// Class4: all descriptive statistics respect the caller's currently assigned classes.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const schoolId = await getSchoolIdFromRequest(event)
  const db = await useSchoolDb(event, schoolId)
  const scope = await resolveSchoolScope(admin, db)
  const allowed = [...(scope.classIdSet || [])]
  if (!scope.schoolWide && !allowed.length) return { data: [], totalRecords: 0 }

  const predicate = and(
    sql`${scoreLogs.description} is not null and ${scoreLogs.description} != ''`,
    scope.schoolWide ? undefined : inArray(users.classId, allowed),
  )
  const stats = await db.select({
    description: scoreLogs.description,
    recordCount: sql<number>`count(*)`,
    totalPositive: sql<number>`coalesce(sum(case when ${scoreLogs.scoreChange} > 0 then ${scoreLogs.scoreChange} else 0 end), 0)`,
    totalNegative: sql<number>`coalesce(sum(case when ${scoreLogs.scoreChange} < 0 then ${scoreLogs.scoreChange} else 0 end), 0)`,
    avgScore: sql<number>`coalesce(avg(${scoreLogs.scoreChange}), 0)`,
    lastUsed: sql<string>`max(${scoreLogs.createdAt})`,
    firstUsed: sql<string>`min(${scoreLogs.createdAt})`,
  }).from(scoreLogs)
    .innerJoin(users, eq(scoreLogs.userId, users.id))
    .where(predicate)
    .groupBy(scoreLogs.description)
    .orderBy(sql`count(*) desc`)
  const totalRecords = stats.reduce((sum, s) => sum + Number(s.recordCount), 0)
  return { data: stats.map(s => ({
    ...s,
    percentage: totalRecords ? Math.round(Number(s.recordCount) / totalRecords * 10000) / 100 : 0,
    avgScore: Math.round(Number(s.avgScore) * 10) / 10,
  })), totalRecords }
})
