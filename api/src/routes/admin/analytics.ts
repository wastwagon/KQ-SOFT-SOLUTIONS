import { Router } from 'express'
import { prisma } from '../../lib/prisma.js'

const router = Router()

router.get('/revenue', async (_req, res) => {
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`

  const [totalRevenue, thisMonthPayments, lastMonthPayments, byPlan, recentPayments] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: 'success' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: 'success', createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: {
        status: 'success',
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          lt: new Date(now.getFullYear(), now.getMonth(), 1),
        },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ['plan'],
      where: { status: 'success' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.findMany({
      where: { status: 'success' },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { organization: { select: { name: true } } },
    }),
  ])

  const total = Number(totalRevenue._sum.amount ?? 0)
  const mrr = Number(thisMonthPayments._sum.amount ?? 0)
  const lastMrr = Number(lastMonthPayments._sum.amount ?? 0)
  const mrrChange = lastMrr > 0 ? ((mrr - lastMrr) / lastMrr) * 100 : 0

  res.json({
    totalRevenue: total,
    mrr,
    mrrChange,
    paymentsCount: totalRevenue._count,
    thisMonthCount: thisMonthPayments._count,
    byPlan: byPlan.map((p) => ({ plan: p.plan, total: Number(p._sum.amount ?? 0), count: p._count })),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      plan: p.plan,
      period: p.period,
      orgName: p.organization.name,
      createdAt: p.createdAt,
    })),
  })
})

export default router
