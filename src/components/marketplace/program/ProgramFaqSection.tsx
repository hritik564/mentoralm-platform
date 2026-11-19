import { Icon } from '@/components/ui/Icon';

export function ProgramFaqSection({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <div className="program-faq">
      {items.map((item, index) => (
        <details key={index} className="program-faq-item">
          <summary>
            <span>{item.question}</span>
            <Icon name="chevron" />
          </summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
