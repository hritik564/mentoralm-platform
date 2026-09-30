export type ProgramAccent =
  'blue' | 'violet' | 'orange' | 'cyan' | 'purple' | 'neutral';
type ProgramBase = {
  id: string;
  position: number;
  name: string;
  label: string;
  description: string;
  accent: ProgramAccent;
};
export type Program =
  | (ProgramBase & {
      status: 'featured';
      storyId?: string;
      direction: string;
      thumbnail: string;
      symbol: 'globe' | 'spark' | 'sunrise' | 'create' | 'mentor';
    })
  | (ProgramBase & { status: 'coming-soon' });
// Editorial public content, not enrollment or learning-domain records.
export const programs: readonly Program[] = [
  {
    id: 'gradlm',
    position: 1,
    name: 'GradLM',
    label: 'Study Abroad',
    description: 'A bigger world. A clearer way to get there.',
    accent: 'blue',
    status: 'featured',
    storyId: 'story-gradlm',
    direction: 'Explore global education',
    thumbnail: '/images/campus.webp',
    symbol: 'globe',
  },
  {
    id: 'ai-career',
    position: 2,
    name: 'AI-Powered Career Counselling',
    label: 'Find your direction',
    description: 'Start with who you are. Explore who you could become.',
    accent: 'violet',
    status: 'featured',
    storyId: 'story-ai-career',
    direction: 'Understand your possibilities',
    thumbnail: '/images/learner.webp',
    symbol: 'spark',
  },
  {
    id: 'careerignite',
    position: 3,
    name: 'CareerIgnite Program',
    label: 'Build your momentum',
    description: 'Turn ambition into skills. And skills into your next step.',
    accent: 'orange',
    status: 'featured',
    storyId: 'story-careerignite',
    direction: 'Build career confidence',
    thumbnail: '/images/collaboration.webp',
    symbol: 'sunrise',
  },
  {
    id: 'entrepreneurship',
    position: 4,
    name: 'Entrepreneurship',
    label: 'Create what’s next',
    description: 'For the ideas that deserve to become something real.',
    accent: 'cyan',
    status: 'featured',
    direction: 'Explore your ideas',
    thumbnail: '/images/entrepreneurship.webp',
    symbol: 'create',
  },
  {
    id: 'career-counsellor',
    position: 5,
    name: 'Career Counsellor Program',
    label: 'Guide the next generation',
    description: 'Become a Professional Certified Career Counsellor.',
    accent: 'purple',
    status: 'featured',
    direction: 'Explore the counsellor pathway',
    thumbnail: '/images/counsellor.webp',
    symbol: 'mentor',
  },
  {
    id: 'future-six',
    position: 6,
    name: 'Coming Soon',
    label: 'More possibilities ahead',
    description: 'Our next chapter is taking shape.',
    accent: 'neutral',
    status: 'coming-soon',
  },
  {
    id: 'future-seven',
    position: 7,
    name: 'Coming Soon',
    label: 'The ecosystem is growing',
    description: 'Another path. The same bigger vision.',
    accent: 'neutral',
    status: 'coming-soon',
  },
];
