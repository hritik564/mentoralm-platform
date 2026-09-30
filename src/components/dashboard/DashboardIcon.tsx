import type { DashboardIconName } from '@/content/dashboard';
const paths = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  courses:
    'M3 5c4-2 7-1 9 1 2-2 5-3 9-1v14c-4-2-7-1-9 1-2-2-5-3-9-1V5zM12 6v14',
  resources: 'M5 3h10l4 4v14H5V3zM14 3v5h5M8 12h8M8 16h6',
  support:
    'M4 13v-1a8 8 0 0 1 16 0v5c0 3-3 4-6 4M4 11H2v7h4v-7H4zM20 11h2v7h-4v-7h2z',
  referral: 'M12 16v5M5 21h14M12 3v10M8 7l4-4 4 4M4 10v5h16v-5',
  profile: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21v-2a8 8 0 0 1 16 0v2',
};
export function DashboardIcon({ name }: { name: DashboardIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
