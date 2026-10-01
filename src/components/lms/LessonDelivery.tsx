import { PrivateMedia } from './PrivateMedia';
import type { LearningRepository } from '@/lib/lms/learning';
import type { LessonContent } from '@/lib/lms/content';
import type { ReactNode } from 'react';
export function StructuredContent({ content }: { content: LessonContent }) {
  return (
    <div className="l2-structured">
      {content.blocks.map((block, index) => {
        let node: ReactNode;
        switch (block.type) {
          case 'heading':
            node =
              block.level === 2 ? <h2>{block.text}</h2> : <h3>{block.text}</h3>;
            break;
          case 'paragraph':
            node = <p>{block.text}</p>;
            break;
          case 'list':
            node = block.ordered ? (
              <ol>
                {block.items.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ol>
            ) : (
              <ul>
                {block.items.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            );
            break;
          case 'callout':
            node = <aside className="l2-callout">{block.text}</aside>;
            break;
          case 'code':
            node = (
              <pre>
                <code>{block.text}</code>
              </pre>
            );
            break;
          case 'divider':
            node = <hr />;
        }
        return <div key={index}>{node}</div>;
      })}
    </div>
  );
}
export function LessonDelivery({
  lesson,
  courseId,
}: {
  lesson: Awaited<ReturnType<LearningRepository['lesson']>>;
  courseId: string;
}) {
  const media = `/api/lms/courses/${courseId}/lessons/${lesson.id}/media`;
  if (!lesson.available)
    return (
      <section className="l2-unavailable">
        <h3>Lesson content unavailable</h3>
        <p>
          This lesson’s content is not available right now. Please try again
          later or contact Support.
        </p>
      </section>
    );
  return (
    <div className="l2-delivery">
      {lesson.content && <StructuredContent content={lesson.content} />}{' '}
      {(lesson.format === 'VIDEO' || lesson.format === 'IMAGE') && (
        <PrivateMedia
          key={media}
          src={media}
          title={lesson.title}
          format={lesson.format}
          alt={lesson.altText || lesson.title}
          captions={
            lesson.captions
              ? `/api/lms/courses/${courseId}/lessons/${lesson.id}/captions`
              : null
          }
        />
      )}
      {lesson.format === 'PDF' && (
        <>
          <iframe title={`${lesson.title} PDF`} src={media} sandbox="" />
          <a href={media} target="_blank" rel="noopener noreferrer">
            Open PDF in a new tab if the viewer is unavailable ↗
          </a>
        </>
      )}
      {lesson.external && (
        <a
          className="lms-action"
          href={lesson.external}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open approved learning link ↗
        </a>
      )}
      {lesson.downloadAllowed && lesson.media && (
        <a href={`${media}?download=1`}>Download lesson file</a>
      )}
    </div>
  );
}
