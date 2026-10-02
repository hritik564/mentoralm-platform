'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { adminHref } from '@/lib/platform/domains';
import { useAdminData, useAdminMutation } from '../client';
import { State, Pill } from '../Primitives';
import { CourseEditor, StructureEditor, Notice } from './forms';
import { ItemEditor } from './ItemEditor';
import type { Builder } from './types';
export function CourseBuilder({ courseRef }: { courseRef: string }) {
  const search = useSearchParams(),
    workspace = useAdminData<Builder>(`academic/courses/${courseRef}`),
    mutation = useAdminMutation(workspace.reload);
  const [courseEditor, setCourseEditor] = useState(false),
    [structure, setStructure] = useState<{
      kind: 'section' | 'item';
      section?: Builder['sections'][number];
    } | null>(null),
    [item, setItem] = useState<{ section: string; ref: string } | null>(
      search.get('item') && search.get('section')
        ? { section: search.get('section')!, ref: search.get('item')! }
        : null,
    );
  const c = workspace.data,
    path = `academic/courses/${courseRef}`;
  async function publishCourse() {
    if (!c) return;
    const {
      title,
      description,
      programRef,
      thumbnailPath,
      thumbnailAlt,
      publicPath,
      academicCompletionEnabled,
      certificateEnabled,
      requiredAttendancePercent,
    } = c;
    await mutation.save(path, {
      title,
      description,
      programId: programRef,
      thumbnailPath,
      thumbnailAlt,
      publicPath,
      published: !c.published,
      academicCompletionEnabled,
      certificateEnabled,
      requiredAttendancePercent,
    });
  }
  return (
    <>
      <Link className="admin-back" href={adminHref('/admin/courses')}>
        ← Programs &amp; Courses
      </Link>
      <State {...workspace} />
      {c && (
        <>
          <div className="admin-page-heading">
            <div>
              <span className="academic-eyebrow">Course Builder</span>
              <h1>{c.title}</h1>
              <p>
                {c.sections.length} Sections ·{' '}
                <Pill tone={c.published ? 'good' : 'neutral'}>
                  {c.published ? 'PUBLISHED' : 'DRAFT'}
                </Pill>
              </p>
            </div>
            <div className="academic-actions">
              <button
                className="admin-button secondary"
                onClick={() => setCourseEditor(true)}
              >
                Course metadata
              </button>
              <button
                className="admin-button"
                disabled={mutation.busy}
                onClick={publishCourse}
              >
                {c.published ? 'Unpublish Course' : 'Publish Course'}
              </button>
            </div>
          </div>
          <Notice message={mutation.notice} />
          <div className="academic-builder-note">
            Course → Section → learning item. Publish configured items, then
            Sections, then Course. Unpublished parents hide all descendants from
            students. Learning history is retained; required content changes can
            affect derived progress.
          </div>
          <div className="academic-builder" aria-label="Course curriculum">
            {c.sections.map((s, n) => (
              <section className="admin-card academic-section" key={s.ref}>
                <header>
                  <div>
                    <span className="academic-eyebrow">Section {n + 1}</span>
                    <h2>{s.title}</h2>
                    {s.description && <p>{s.description}</p>}
                    <Pill>{s.published ? 'PUBLISHED' : 'DRAFT'}</Pill>
                  </div>
                  <div className="academic-actions">
                    <button
                      className="admin-button secondary"
                      disabled={mutation.busy || n === 0}
                      aria-label={`Move section ${s.title} up`}
                      onClick={() =>
                        mutation.save(`${path}/sections/${s.ref}/order`, {
                          direction: 'UP',
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      className="admin-button secondary"
                      disabled={mutation.busy || n === c.sections.length - 1}
                      aria-label={`Move section ${s.title} down`}
                      onClick={() =>
                        mutation.save(`${path}/sections/${s.ref}/order`, {
                          direction: 'DOWN',
                        })
                      }
                    >
                      ↓
                    </button>
                    <button
                      className="admin-button secondary"
                      onClick={() =>
                        setStructure({ kind: 'section', section: s })
                      }
                    >
                      Edit Section
                    </button>
                    <button
                      className="admin-button secondary"
                      disabled={mutation.busy}
                      onClick={() =>
                        mutation.save(`${path}/sections/${s.ref}`, {
                          title: s.title,
                          description: s.description,
                          published: !s.published,
                        })
                      }
                    >
                      {s.published ? 'Unpublish Section' : 'Publish Section'}
                    </button>
                    <button
                      className="admin-button secondary"
                      disabled={
                        mutation.busy || s.published || s.items.length > 0
                      }
                      onClick={() => {
                        if (confirm('Delete this empty draft Section?'))
                          void mutation.save(
                            `${path}/sections/${s.ref}/delete`,
                            { confirm: true },
                          );
                      }}
                    >
                      Delete empty Section
                    </button>
                  </div>
                </header>
                <ol className="academic-item-list">
                  {s.items.map((i, m) => (
                    <li key={i.ref}>
                      <span className="academic-item-number">{m + 1}</span>
                      <div className="academic-item-main">
                        <button
                          className="academic-text-button"
                          onClick={() =>
                            setItem({ section: s.ref, ref: i.ref })
                          }
                        >
                          {i.title}
                        </button>
                        <div className="academic-item-tags">
                          <Pill>{i.type}</Pill>
                          <span>{i.required ? 'Required' : 'Optional'}</span>
                          <span>{i.published ? 'PUBLISHED' : 'DRAFT'}</span>
                          {i.format && <span>{i.format}</span>}
                          {i.type === 'LIVE_SESSION' && (
                            <span>{i.occurrences} Batch occurrences</span>
                          )}
                        </div>
                      </div>
                      <div className="academic-actions">
                        <button
                          className="admin-button secondary"
                          disabled={mutation.busy || m === 0}
                          aria-label={`Move item ${i.title} up`}
                          onClick={() =>
                            mutation.save(
                              `${path}/sections/${s.ref}/items/${i.ref}/order`,
                              { direction: 'UP' },
                            )
                          }
                        >
                          ↑
                        </button>
                        <button
                          className="admin-button secondary"
                          disabled={mutation.busy || m === s.items.length - 1}
                          aria-label={`Move item ${i.title} down`}
                          onClick={() =>
                            mutation.save(
                              `${path}/sections/${s.ref}/items/${i.ref}/order`,
                              { direction: 'DOWN' },
                            )
                          }
                        >
                          ↓
                        </button>
                        <button
                          className="admin-button secondary"
                          onClick={() =>
                            setItem({ section: s.ref, ref: i.ref })
                          }
                        >
                          Edit item
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                {!s.items.length && (
                  <p className="admin-empty">
                    No learning items. Add and configure the first item.
                  </p>
                )}
                <button
                  className="admin-button secondary"
                  onClick={() => setStructure({ kind: 'item', section: s })}
                >
                  Add learning item
                </button>
              </section>
            ))}
          </div>
          {!c.sections.length && (
            <section className="admin-card">
              <p>No Sections yet. Start the curriculum below.</p>
            </section>
          )}
          <button
            className="admin-button academic-add-section"
            onClick={() => setStructure({ kind: 'section' })}
          >
            Add Section
          </button>
          {courseEditor && (
            <CourseEditor
              initial={c}
              onClose={() => setCourseEditor(false)}
              onSaved={workspace.reload}
            />
          )}
          {structure && (
            <StructureEditor
              kind={structure.kind}
              courseRef={courseRef}
              sectionRef={structure.section?.ref}
              initial={
                structure.kind === 'section' ? structure.section : undefined
              }
              onClose={() => setStructure(null)}
              onSaved={workspace.reload}
            />
          )}
        </>
      )}
      {item && (
        <ItemEditor
          courseRef={courseRef}
          sectionRef={item.section}
          itemRef={item.ref}
          onClose={() => setItem(null)}
          onSaved={workspace.reload}
        />
      )}
    </>
  );
}
