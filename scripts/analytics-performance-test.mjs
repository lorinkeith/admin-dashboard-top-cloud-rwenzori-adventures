import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/analyticsPerformance.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: false,
  },
}).outputText

const analyticsModule = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const { calculatePackagePerformance, sortPackagesByPerformance } = analyticsModule

function createPackage(overrides) {
  return {
    bookings: 0,
    category: 'Safari',
    durationDays: 3,
    imageUrl: null,
    inquiries: 0,
    packageSlug: overrides.tourId,
    packageTitle: overrides.tourId,
    tourId: overrides.tourId,
    uniqueVisitors: 0,
    views: 0,
    ...overrides,
  }
}

function findPackage(packages, tourId) {
  return packages.find((tourPackage) => tourPackage.tourId === tourId)
}

{
  const scored = calculatePackagePerformance([
    createPackage({ tourId: 'high-views', views: 500, uniqueVisitors: 300 }),
    createPackage({ tourId: 'buyer', views: 100, uniqueVisitors: 80, inquiries: 4, bookings: 2 }),
  ])
  assert.notEqual(findPackage(scored, 'high-views').performanceLevel, 'excellent')
}

{
  const ranked = sortPackagesByPerformance(calculatePackagePerformance([
    createPackage({ tourId: 'traffic-only', views: 500, uniqueVisitors: 300 }),
    createPackage({ tourId: 'high-intent', views: 180, uniqueVisitors: 120, inquiries: 20, bookings: 10 }),
  ]))
  assert.equal(ranked[0].tourId, 'high-intent')
}

{
  const ranked = sortPackagesByPerformance(calculatePackagePerformance([
    createPackage({ tourId: 'leader', views: 300, uniqueVisitors: 200, inquiries: 10, bookings: 5 }),
    createPackage({ tourId: 'runner-up', views: 250, uniqueVisitors: 180, inquiries: 8, bookings: 3 }),
  ]))
  assert.equal(ranked[0].performanceLevel, 'top')
  assert.equal(ranked.filter((tourPackage) => tourPackage.performanceLevel === 'top').length, 1)
}

{
  const scored = calculatePackagePerformance([
    createPackage({ tourId: 'zero-a' }),
    createPackage({ tourId: 'zero-b' }),
  ])
  assert.ok(scored.every((tourPackage) => tourPackage.performanceScore === 0))
  assert.ok(scored.every((tourPackage) => tourPackage.performanceLevel === 'low'))
  assert.ok(scored.every((tourPackage) => tourPackage.isTopPerformer === false))
}

{
  const scored = calculatePackagePerformance([
    createPackage({ tourId: 'no-inquiry-max', views: 40, uniqueVisitors: 20, bookings: 1 }),
    createPackage({ tourId: 'also-no-inquiry', views: 20, uniqueVisitors: 10 }),
  ])
  assert.ok(scored.every((tourPackage) => Number.isFinite(tourPackage.performanceScore)))
}

{
  const scored = calculatePackagePerformance([
    createPackage({ tourId: 'no-booking-max', views: 40, uniqueVisitors: 20, inquiries: 1 }),
    createPackage({ tourId: 'also-no-booking', views: 20, uniqueVisitors: 10 }),
  ])
  assert.ok(scored.every((tourPackage) => Number.isFinite(tourPackage.performanceScore)))
}

{
  const base = {
    isTopPerformer: false,
    performanceLevel: 'good',
    performanceScore: 70,
  }

  assert.equal(sortPackagesByPerformance([
    { ...createPackage({ tourId: 'fewer-bookings', bookings: 1, inquiries: 20, uniqueVisitors: 200, views: 900 }), ...base },
    { ...createPackage({ tourId: 'more-bookings', bookings: 2, inquiries: 1, uniqueVisitors: 1, views: 1 }), ...base },
  ])[0].tourId, 'more-bookings')

  assert.equal(sortPackagesByPerformance([
    { ...createPackage({ tourId: 'fewer-inquiries', bookings: 1, inquiries: 1, uniqueVisitors: 200, views: 900 }), ...base },
    { ...createPackage({ tourId: 'more-inquiries', bookings: 1, inquiries: 2, uniqueVisitors: 1, views: 1 }), ...base },
  ])[0].tourId, 'more-inquiries')

  assert.equal(sortPackagesByPerformance([
    { ...createPackage({ tourId: 'fewer-visitors', bookings: 1, inquiries: 1, uniqueVisitors: 1, views: 900 }), ...base },
    { ...createPackage({ tourId: 'more-visitors', bookings: 1, inquiries: 1, uniqueVisitors: 2, views: 1 }), ...base },
  ])[0].tourId, 'more-visitors')

  assert.equal(sortPackagesByPerformance([
    { ...createPackage({ tourId: 'fewer-views', bookings: 1, inquiries: 1, uniqueVisitors: 1, views: 1 }), ...base },
    { ...createPackage({ tourId: 'more-views', bookings: 1, inquiries: 1, uniqueVisitors: 1, views: 2 }), ...base },
  ])[0].tourId, 'more-views')
}

{
  const last7Days = sortPackagesByPerformance(calculatePackagePerformance([
    createPackage({ tourId: 'week-winner', views: 50, uniqueVisitors: 40, inquiries: 5, bookings: 3 }),
    createPackage({ tourId: 'month-winner', views: 10, uniqueVisitors: 8, inquiries: 0, bookings: 0 }),
  ]))
  const last30Days = sortPackagesByPerformance(calculatePackagePerformance([
    createPackage({ tourId: 'week-winner', views: 60, uniqueVisitors: 50, inquiries: 5, bookings: 3 }),
    createPackage({ tourId: 'month-winner', views: 300, uniqueVisitors: 240, inquiries: 30, bookings: 14 }),
  ]))
  assert.equal(last7Days[0].tourId, 'week-winner')
  assert.equal(last30Days[0].tourId, 'month-winner')
}

{
  const ranked = sortPackagesByPerformance(calculatePackagePerformance([
    createPackage({ tourId: 'gorilla', packageTitle: 'Gorilla Tour', views: 100, uniqueVisitors: 80, inquiries: 3, bookings: 1 }),
    createPackage({ tourId: 'wildlife', packageTitle: 'Wildlife Tour', views: 500, uniqueVisitors: 400, inquiries: 20, bookings: 10 }),
  ]))
  const gorillaBeforeSearch = findPackage(ranked, 'gorilla').performanceScore
  const searchResults = ranked.filter((tourPackage) => tourPackage.packageTitle.toLowerCase().includes('gorilla'))
  assert.equal(searchResults[0].performanceScore, gorillaBeforeSearch)
}

{
  const ranked = sortPackagesByPerformance(calculatePackagePerformance(Array.from({ length: 8 }, (_, index) => (
    createPackage({
      tourId: `package-${index + 1}`,
      views: 100 - index,
      uniqueVisitors: 80 - index,
      inquiries: Math.max(0, 8 - index),
      bookings: Math.max(0, 4 - index),
    })
  ))))
  const beforePagination = ranked[6].performanceScore
  const secondPage = ranked.slice(5, 10)
  assert.equal(secondPage[1].performanceScore, beforePagination)
}

console.log('Analytics performance tests passed')

