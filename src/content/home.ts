export const navigation = [
  { label: 'Programs', href: '#programs' },
  { label: 'Opportunities', href: '#opportunities' },
  { label: 'Resources', href: '#resources' },
  { label: 'About', href: '#about' },
] as const;
export const journey = [
  {
    number: '01',
    title: 'Understand',
    description: 'Your strengths. Your interests. Your ambitions.',
    note: 'Start with yourself.',
  },
  {
    number: '02',
    title: 'Explore',
    description: 'Careers, education, and possibilities worth considering.',
    note: 'See a wider world.',
  },
  {
    number: '03',
    title: 'Build',
    description: 'The skills, profile, and confidence to take your next step.',
    note: 'Make progress tangible.',
  },
  {
    number: '04',
    title: 'Move Forward',
    description: 'Your next application, career move, or new idea.',
    note: 'Turn clarity into action.',
  },
] as const;
export const opportunities = [
  {
    title: 'Internships & careers',
    description: 'Experience that moves you forward.',
    icon: 'briefcase',
  },
  {
    title: 'Scholarships',
    description: 'Possibilities beyond the price tag.',
    icon: 'spark',
  },
  {
    title: 'Events & experiences',
    description: 'Meet ideas. Find your people.',
    icon: 'globe',
  },
] as const;
export const notices = {
  menti: {
    title: 'Meet Menti. Soon.',
    description:
      'Menti is our envisioned conversational intelligence layer, designed to bring helpful guidance into your journey. It is not available yet. For now, explore the MentoraLM pathways below.',
  },
  login: {
    title: 'One account. A connected future.',
    description:
      'Sign-in is not available in this website preview. The future MentoraLM account is intended to connect your website, student portal, and learning experience.',
  },
  legal: {
    title: 'Policies are being prepared.',
    description:
      'Approved privacy and terms documents will be published before account creation or enrollment becomes available. This preview does not collect applications or account information.',
  },
  support: {
    title: 'Let’s connect. Soon.',
    description:
      'Official support channels and contact details will be added once approved. No inquiry or enrollment information is collected in this preview.',
  },
} as const;
