import {
  FiBriefcase,
  FiFileText,
  FiBarChart2,
  FiInbox,
  FiTag,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'

export type NavigationBadgeKey = 'bookings' | 'inquiries'

type NavigationItem = {
  label: string
  href: string
  icon: IconType
  badgeKey?: NavigationBadgeKey
}

export const navigationItems: NavigationItem[] = [
  { label: 'Tour Packages', href: '/packages', icon: FiTag },
  { label: 'Blog', href: '/blog', icon: FiFileText },
  { label: 'Analytics', href: '/analytics', icon: FiBarChart2 },
  { label: 'Bookings', href: '/bookings', icon: FiBriefcase, badgeKey: 'bookings' },
  { label: 'Inquiries', href: '/inquiries', icon: FiInbox, badgeKey: 'inquiries' },
]
