const paths: Record<string, string> = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  marketplace:
    'M3 9h18l-2-6H5L3 9zM4 9v12h16V9M9 21v-7h6v7M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0',
  learning:
    'M3 5c4-2 7-1 9 1 2-2 5-3 9-1v14c-4-2-7-1-9 1-2-2-5-3-9-1V5zM12 6v14',
  courses:
    'M3 5c4-2 7-1 9 1 2-2 5-3 9-1v14c-4-2-7-1-9 1-2-2-5-3-9-1V5zM12 6v14',
  students: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21v-2a8 8 0 0 1 16 0v2',
  people:
    'M14 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM3 21v-2a7 7 0 0 1 14 0v2M17 4a3 3 0 0 1 0 6M20 21v-2a5 5 0 0 0-3-4',
  inbox: 'M4 4h16l2 11v5H2v-5L4 4zM2 15h6l2 3h4l2-3h6',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10 2h4l1 3 3 1 3 3-1 3 1 3-3 3-3 1-1 3h-4l-1-3-3-1-3-3 1-3-1-3 3-3 3-1 1-3z',
  batches: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2',
  calendar: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M9 15l2 2 4-4',
  video: 'M3 5h13v14H3zM16 10l5-3v10l-5-3M7 9l5 3-5 3V9z',
  document: 'M5 3h10l4 4v14H5V3zM14 3v5h5M8 12h8M8 16h6',
  check: 'M4 4h16v16H4zM8 12l3 3 5-6',
  award: 'M8 15l-2 7 6-3 6 3-2-7M18 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0z',
  message: 'M3 4h18v13H9l-6 4V4zM7 9h10M7 13h6',
  send: 'M3 11l18-8-7 18-3-7-8-3zM11 14L21 3',
  shield: 'M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4zM8 12l3 3 5-6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  plus: 'M12 4v16M4 12h16',
  menu: 'M4 6h16M4 12h16M4 18h16',
};
export function AdminIcon({ name }: { name: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.overview} />
    </svg>
  );
}
