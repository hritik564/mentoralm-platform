import { Icon } from '@/components/ui/Icon';

export function ProgramListSection({ items }: { items: string[] }) {
  return (
    <ul className="program-section-list">
      {items.map((item, index) => (
        <li key={index}>
          <span className="program-list-marker">
            <Icon name="check" />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
