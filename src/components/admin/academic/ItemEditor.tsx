'use client';
import { useAdminData, useAdminMutation } from '../client';
import { AdminDialog, State } from '../Primitives';
import { Field, FormActions } from './forms';
import { LessonEditor, ResourceEditor } from './LessonEditor';
import { ActivityEditor, AssignmentEditor } from './ActivityEditor';
import { LiveEditor } from './LiveEditor';
import type { ItemDetail } from './types';
export function ItemEditor({
  courseRef,
  sectionRef,
  itemRef,
  onClose,
  onSaved,
}: {
  courseRef: string;
  sectionRef: string;
  itemRef: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const path = `academic/courses/${courseRef}/sections/${sectionRef}/items/${itemRef}`,
    item = useAdminData<ItemDetail>(path),
    mutation = useAdminMutation(() => {
      item.reload();
      onSaved();
    }),
    i = item.data;
  function saved() {
    item.reload();
    onSaved();
  }
  return (
    <AdminDialog
      title={
        i ? `${i.type.replaceAll('_', ' ')} editor` : 'Learning item editor'
      }
      onClose={onClose}
    >
      <div className="academic-editor">
        <State {...item} />
        {i && (
          <>
            <form
              className="admin-form academic-item-settings"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await mutation.save(path, {
                  title: f.get('title'),
                  type: i.type,
                  required: f.has('required'),
                  published: f.has('published'),
                });
              }}
            >
              <Field label="Learning item title">
                <input
                  name="title"
                  required
                  maxLength={160}
                  defaultValue={i.title}
                />
              </Field>
              <div className="academic-actions">
                <label className="academic-check">
                  <input
                    name="required"
                    type="checkbox"
                    defaultChecked={i.required}
                  />{' '}
                  Required where supported
                </label>
                <label className="academic-check">
                  <input
                    name="published"
                    type="checkbox"
                    defaultChecked={i.published}
                  />{' '}
                  Published
                </label>
              </div>
              <p className="admin-muted">
                Configure and save content below before publishing. Parent
                Section and Course publication are checked separately. Item type
                is fixed; create another item to change its type.
              </p>
              <FormActions busy={mutation.busy} notice={mutation.notice} />
            </form>
            {i.type === 'LESSON' ? (
              <LessonEditor key={i.ref} item={i} path={path} onSaved={saved} />
            ) : i.type === 'RESOURCE' ? (
              <ResourceEditor item={i} path={path} onSaved={saved} />
            ) : i.type === 'QUIZ' || i.type === 'ASSESSMENT' ? (
              <ActivityEditor
                key={i.ref}
                item={i}
                path={path}
                onSaved={saved}
              />
            ) : i.type === 'ASSIGNMENT' ? (
              <AssignmentEditor item={i} path={path} onSaved={saved} />
            ) : (
              <LiveEditor
                item={i}
                path={path}
                courseRef={courseRef}
                onSaved={saved}
              />
            )}
            <section className="academic-editor-panel">
              <h3>Safe removal</h3>
              <p className="admin-muted">
                Only draft items without lesson state, attempts, submissions,
                session references, attached media or Course certificates can be
                removed. Unpublish to retain history.
              </p>
              <button
                className="admin-button secondary"
                disabled={i.published || mutation.busy}
                onClick={async () => {
                  if (
                    confirm(
                      'Delete this draft item? Referenced history or media will block removal.',
                    )
                  ) {
                    const r = await mutation.save(`${path}/delete`, {
                      confirm: true,
                    });
                    if (r) onClose();
                  }
                }}
              >
                Delete unused draft item
              </button>
            </section>
          </>
        )}
      </div>
    </AdminDialog>
  );
}
