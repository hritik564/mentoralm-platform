import type { IconName } from '@/components/ui/Icon';

export type HomepageProgram = {
  id: 'careerignite' | 'youngminds-ai-lab';
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  features: readonly { label: string; icon: IconName }[];
};
// Public editorial content only; these cards do not grant enrollment or learning access.
export const homepagePrograms: readonly HomepageProgram[] = [
  {
    id: 'careerignite',
    title: 'CareerIgnite',
    subtitle: 'Build Skills. Gain Confidence. Get Career Ready.',
    image: '/images/homepage/careerignite.webp',
    imageAlt:
      'Illustrative Indian university student holding a laptop and notebook on a campus at dusk',
    features: [
      { label: 'Career Readiness', icon: 'briefcase' },
      { label: 'Live Mentoring', icon: 'mentor' },
      { label: 'Projects', icon: 'create' },
    ],
  },
  {
    id: 'youngminds-ai-lab',
    title: 'YoungMinds AI Lab',
    subtitle: 'AI & Tech Discovery for Young Learners',
    image: '/images/homepage/youngminds-ai-lab.webp',
    imageAlt:
      'Illustrative young Indian learner exploring a luminous science model with a friendly robot and laptop',
    features: [
      { label: 'AI Basics', icon: 'spark' },
      { label: 'Creative Learning', icon: 'create' },
      { label: 'Future Skills', icon: 'globe' },
    ],
  },
];
