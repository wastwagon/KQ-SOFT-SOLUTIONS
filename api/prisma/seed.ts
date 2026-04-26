/**
 * Seed: admin account + one org/user per subscription level for testing.
 * Run: npx prisma db seed
 * Test password for all: Test123!
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const SALT_ROUNDS = 10
const TEST_PASSWORD = 'Test123!'

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, SALT_ROUNDS)

  // Plans (subscription tiers)
  const plans = [
    { slug: 'basic', name: 'Basic', projectsPerMonth: 5, transactionsPerMonth: 500, monthlyGhs: 150, yearlyGhs: 1500 },
    { slug: 'standard', name: 'Standard', projectsPerMonth: 20, transactionsPerMonth: 2000, monthlyGhs: 400, yearlyGhs: 4000 },
    { slug: 'premium', name: 'Premium', projectsPerMonth: 100, transactionsPerMonth: 10000, monthlyGhs: 900, yearlyGhs: 9000 },
    { slug: 'firm', name: 'Firm', projectsPerMonth: -1, transactionsPerMonth: -1, monthlyGhs: 0, yearlyGhs: 0 },
  ]
  for (const p of plans) {
    await prisma.plan.upsert({
      where: { slug: p.slug },
      create: p,
      update: p,
    })
  }
  console.log('Plans seeded:', plans.map((p) => p.slug).join(', '))

  // Admin: one user + org (plan: firm, role: admin)
  const adminEmail = 'admin@kqsoftwaresolutions.com'
  let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Admin User',
      },
    })
    console.log('Created admin user:', adminEmail)
  }
  const adminOrgSlug = 'kqsoft-admin'
  let adminOrg = await prisma.organization.findUnique({ where: { slug: adminOrgSlug } })
  if (!adminOrg) {
    adminOrg = await prisma.organization.create({
      data: {
        name: 'KQ-SOFT Admin',
        slug: adminOrgSlug,
        plan: 'firm',
        members: {
          create: { userId: adminUser.id, role: 'admin' },
        },
      },
    })
    console.log('Created admin org (plan: firm):', adminOrg.name)
  } else {
    await prisma.organization.update({
      where: { id: adminOrg.id },
      data: { plan: 'firm' },
    })
    const mem = await prisma.organizationMember.findFirst({
      where: { organizationId: adminOrg.id, userId: adminUser.id },
    })
    if (!mem) {
      await prisma.organizationMember.create({
        data: { organizationId: adminOrg.id, userId: adminUser.id, role: 'admin' },
      })
    } else if (mem.role !== 'admin') {
      await prisma.organizationMember.update({
        where: { id: mem.id },
        data: { role: 'admin' },
      })
    }
  }

  // One org + user per subscription level (for feature/limit testing)
  const tiers = [
    { plan: 'basic', email: 'basic@test.com', name: 'Basic User', orgName: 'Test Basic Org', slug: 'test-basic' },
    { plan: 'standard', email: 'standard@test.com', name: 'Standard User', orgName: 'Test Standard Org', slug: 'test-standard' },
    { plan: 'premium', email: 'premium@test.com', name: 'Premium User', orgName: 'Test Premium Org', slug: 'test-premium' },
    { plan: 'firm', email: 'firm@test.com', name: 'Firm User', orgName: 'Test Firm Org', slug: 'test-firm' },
  ]

  for (const t of tiers) {
    let user = await prisma.user.findUnique({ where: { email: t.email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email: t.email, passwordHash, name: t.name },
      })
      console.log('Created user:', t.email)
    }
    let org = await prisma.organization.findUnique({ where: { slug: t.slug } })
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: t.orgName,
          slug: t.slug,
          plan: t.plan,
          members: {
            create: { userId: user.id, role: 'admin' },
          },
        },
      })
      console.log('Created org (plan: %s): %s', t.plan, t.orgName)
    } else {
      await prisma.organization.update({
        where: { id: org.id },
        data: { plan: t.plan },
      })
      const mem = await prisma.organizationMember.findFirst({
        where: { organizationId: org.id, userId: user.id },
      })
      if (!mem) {
        await prisma.organizationMember.create({
          data: { organizationId: org.id, userId: user.id, role: 'admin' },
        })
      }
    }

    // Sync a realistic subscription sample for each tier.
    // Basic: no payment (trial/free flow), Standard/Premium/Firm: active paid samples.
    if (org) {
      if (t.plan === 'basic') {
        // Keep basic without payment to exercise trial/free experience.
      } else {
        const monthlyAmount =
          t.plan === 'standard' ? 400 :
          t.plan === 'premium' ? 900 :
          t.plan === 'firm' ? 1500 : 0
        const yearlyAmount =
          t.plan === 'standard' ? 4000 :
          t.plan === 'premium' ? 9000 :
          t.plan === 'firm' ? 15000 : 0
        const period: 'monthly' | 'yearly' = t.plan === 'firm' ? 'yearly' : 'monthly'
        const amount = period === 'monthly' ? monthlyAmount : yearlyAmount
        if (amount > 0) {
          const reference = `seed_${org.id}_${period}_active`
          await prisma.payment.upsert({
            where: { reference },
            create: {
              organizationId: org.id,
              amount,
              currency: 'GHS',
              plan: t.plan,
              period,
              status: 'success',
              reference,
              paystackData: { seeded: true, source: 'prisma-seed' },
            },
            update: {
              amount,
              plan: t.plan,
              period,
              status: 'success',
            },
          })
        }
      }
    }
  }

  console.log('\nSeed done. All test accounts use password: %s', TEST_PASSWORD)
  console.log('Admin: %s (org plan: firm, role: admin)', adminEmail)
  console.log('Tiers: basic@test.com, standard@test.com, premium@test.com, firm@test.com')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
