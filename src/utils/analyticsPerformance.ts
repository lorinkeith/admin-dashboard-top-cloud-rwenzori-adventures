import type { PackageAnalyticsRow } from '../types/analytics'

export type PerformanceLevel = 'top' | 'excellent' | 'good' | 'average' | 'low'

export type PackagePerformanceResult = PackageAnalyticsRow & {
  performanceLevel: PerformanceLevel
  performanceScore: number
  isTopPerformer: boolean
}

type MetricKey = 'views' | 'uniqueVisitors' | 'inquiries' | 'bookings'

const metricWeights: Record<MetricKey, number> = {
  bookings: 0.25,
  inquiries: 0.25,
  uniqueVisitors: 0.2,
  views: 0.3,
}

function getMetricMax(packages: PackageAnalyticsRow[], metric: MetricKey) {
  return Math.max(0, ...packages.map((tourPackage) => tourPackage[metric]))
}

function getNormalizedScore(value: number, maxValue: number) {
  if (maxValue <= 0) return 0
  return (value / maxValue) * 100
}

function getPerformanceLevel(tourPackage: PackageAnalyticsRow, score: number): Exclude<PerformanceLevel, 'top'> {
  if (score >= 80) {
    return tourPackage.inquiries > 0 || tourPackage.bookings > 0 ? 'excellent' : 'good'
  }

  if (score >= 60) return 'good'
  if (score >= 30) return 'average'
  return 'low'
}

function comparePerformance(firstPackage: PackagePerformanceResult, secondPackage: PackagePerformanceResult) {
  const scoreDifference = secondPackage.performanceScore - firstPackage.performanceScore
  if (scoreDifference !== 0) return scoreDifference

  const bookingDifference = secondPackage.bookings - firstPackage.bookings
  if (bookingDifference !== 0) return bookingDifference

  const inquiryDifference = secondPackage.inquiries - firstPackage.inquiries
  if (inquiryDifference !== 0) return inquiryDifference

  const visitorDifference = secondPackage.uniqueVisitors - firstPackage.uniqueVisitors
  if (visitorDifference !== 0) return visitorDifference

  const viewDifference = secondPackage.views - firstPackage.views
  if (viewDifference !== 0) return viewDifference

  return firstPackage.packageTitle.localeCompare(secondPackage.packageTitle)
}

export function calculatePackagePerformance(packages: PackageAnalyticsRow[]): PackagePerformanceResult[] {
  const maximums: Record<MetricKey, number> = {
    bookings: getMetricMax(packages, 'bookings'),
    inquiries: getMetricMax(packages, 'inquiries'),
    uniqueVisitors: getMetricMax(packages, 'uniqueVisitors'),
    views: getMetricMax(packages, 'views'),
  }

  const scoredPackages = packages.map<PackagePerformanceResult>((tourPackage) => {
    const viewScore = getNormalizedScore(tourPackage.views, maximums.views)
    const visitorScore = getNormalizedScore(tourPackage.uniqueVisitors, maximums.uniqueVisitors)
    const inquiryScore = getNormalizedScore(tourPackage.inquiries, maximums.inquiries)
    const bookingScore = getNormalizedScore(tourPackage.bookings, maximums.bookings)
    const performanceScore = Math.round(
      viewScore * metricWeights.views +
      visitorScore * metricWeights.uniqueVisitors +
      inquiryScore * metricWeights.inquiries +
      bookingScore * metricWeights.bookings,
    )

    return {
      ...tourPackage,
      isTopPerformer: false,
      performanceLevel: getPerformanceLevel(tourPackage, performanceScore),
      performanceScore,
    }
  })

  const hasAnyActivity = scoredPackages.some((tourPackage) => tourPackage.performanceScore > 0)

  if (!hasAnyActivity) {
    return scoredPackages
  }

  const topPerformer = [...scoredPackages].sort(comparePerformance)[0]

  return scoredPackages.map((tourPackage) => (
    tourPackage.tourId === topPerformer.tourId
      ? { ...tourPackage, isTopPerformer: true, performanceLevel: 'top' }
      : tourPackage
  ))
}

export function sortPackagesByPerformance(packages: PackagePerformanceResult[]) {
  return [...packages].sort(comparePerformance)
}