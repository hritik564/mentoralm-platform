export const dashboardNavigation = [
  { href: '/dashboard', label: 'Overview', icon: 'overview' },
  { href: '/dashboard/courses', label: 'My Courses', icon: 'courses' },
  { href: '/dashboard/resources', label: 'Resources', icon: 'resources' },
  { href: '/dashboard/support', label: 'Support', icon: 'support' },
  { href: '/dashboard/referral', label: 'Referral', icon: 'referral' },
  { href: '/dashboard/profile', label: 'Profile', icon: 'profile' },
] as const;
export type DashboardIconName = (typeof dashboardNavigation)[number]['icon'];

export const dashboardEmptyStates = {
  courses: {
    title: 'My Courses',
    heading: 'Your learning, in one place.',
    description: 'Your viewed and enrolled courses will appear here.',
    detail:
      'Course discovery, enrollment and learning are being developed. No course records are available yet.',
    icon: 'courses',
  },
  resources: {
    title: 'Resources',
    heading: 'Space for your next discovery.',
    description: 'Learning and career resources will appear here.',
    detail:
      'The resource library is being developed. Downloads and saved resources are not available yet.',
    icon: 'resources',
  },
  support: {
    title: 'Support',
    heading: 'A place to ask for direction.',
    description: 'Your MentoraLM support space is taking shape.',
    detail:
      'Support requests and ticket tracking are not available yet. No request is submitted from this page.',
    icon: 'support',
  },
  referral: {
    title: 'Referral',
    heading: 'Good journeys are worth sharing.',
    description: 'Your referral space will appear here.',
    detail:
      'Referral features and business rules are still being defined. No rewards or earnings are offered here yet.',
    icon: 'referral',
  },
  profile: {
    title: 'Profile',
    heading: 'A profile that grows with you.',
    description: 'Your personal and career profile will live here.',
    detail:
      'Personal details, contact details, career and education, settings, security, notifications and privacy will be organized within Profile. Profile editing is not available yet.',
    icon: 'profile',
  },
} as const;
