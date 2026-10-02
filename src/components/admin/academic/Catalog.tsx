'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminHref } from '@/lib/platform/domains';
import { useAdminData } from '../client';
import { State, Table, Pager, Pill, Tabs } from '../Primitives';
import { TitleEditor, CourseEditor, Field } from './forms';
import type { Programs, Courses, Activities, Banks, Choices } from './types';
export function AcademicWorkspace() {
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Programs &amp; Courses</h1>
          <p>
            Manage the academic catalog and build the same content students
            learn from.
          </p>
        </div>
      </div>
      <Tabs labels={['Courses', 'Programs']}>
        {(tab) => (tab === 'Courses' ? <CourseList /> : <ProgramList />)}
      </Tabs>
    </>
  );
}
function CourseList() {
  const [page, setPage] = useState(1),
    [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [program, setProgram] = useState(''),
    [programQuery, setProgramQuery] = useState(''),
    [create, setCreate] = useState(false),
    router = useRouter();
  const list = useAdminData<Courses>(
      `academic/courses?${new URLSearchParams({ page: String(page), q, status, program })}`,
    ),
    programs = useAdminData<Choices>(
      `choices/programs?q=${encodeURIComponent(programQuery)}`,
    );
  return (
    <>
      <div className="academic-toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQ(String(new FormData(e.currentTarget).get('q') || ''));
            setPage(1);
          }}
        >
          <Field label="Search Courses">
            <input name="q" placeholder="Search title" maxLength={100} />
          </Field>
          <Field label="Find Program">
            <input
              value={programQuery}
              maxLength={100}
              placeholder="Search Program title"
              onChange={(e) => setProgramQuery(e.target.value)}
            />
          </Field>
          <Field label="Program filter">
            <select
              value={program}
              onChange={(e) => {
                setProgram(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Programs</option>
              {program && !programs.data?.some((p) => p.ref === program) && (
                <option value={program}>Current selected Program</option>
              )}
              {programs.data?.map((p) => (
                <option key={p.ref} value={p.ref}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Publication filter">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option>DRAFT</option>
              <option>PUBLISHED</option>
            </select>
          </Field>
          <button className="admin-button secondary">Search</button>
        </form>
        <button className="admin-button" onClick={() => setCreate(true)}>
          Create Course
        </button>
      </div>
      <State {...list} />
      {list.data && (
        <section className="admin-card academic-table">
          <Table
            headers={['Course', 'Program', 'Status', 'Sections', 'Enrollments']}
            caption="Academic Courses"
          >
            {list.data.rows.map((c) => (
              <tr key={c.ref}>
                <td>
                  <Link href={adminHref(`/admin/courses/${c.ref}`)}>
                    {c.title}
                  </Link>
                </td>
                <td>{c.program}</td>
                <td>
                  <Pill tone={c.published ? 'good' : 'neutral'}>
                    {c.published ? 'PUBLISHED' : 'DRAFT'}
                  </Pill>
                </td>
                <td>{c.sections}</td>
                <td>{c.enrollments}</td>
              </tr>
            ))}
          </Table>
          {!list.data.rows.length && (
            <p className="admin-empty">No Courses match these filters.</p>
          )}
          <Pager page={page} total={list.data.total} onPage={setPage} />
        </section>
      )}
      {create && (
        <CourseEditor
          onClose={() => setCreate(false)}
          onSaved={(ref) => router.push(adminHref(`/admin/courses/${ref}`))}
        />
      )}
    </>
  );
}
function ProgramList() {
  const [page, setPage] = useState(1),
    [q, setQ] = useState(''),
    [editor, setEditor] = useState<
      { ref: string; title: string } | 'new' | null
    >(null),
    [selected, setSelected] = useState<string | null>(null);
  const list = useAdminData<Programs>(
      `academic/programs?page=${page}&q=${encodeURIComponent(q)}`,
    ),
    courses = useAdminData<Courses>(
      selected ? `academic/courses?program=${selected}` : null,
    );
  return (
    <>
      <div className="academic-toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQ(String(new FormData(e.currentTarget).get('q') || ''));
            setPage(1);
          }}
        >
          <Field label="Search Programs">
            <input name="q" maxLength={100} />
          </Field>
          <button className="admin-button secondary">Search</button>
        </form>
        <button className="admin-button" onClick={() => setEditor('new')}>
          Create Program
        </button>
      </div>
      <State {...list} />
      {list.data && (
        <section className="admin-card academic-table">
          <Table headers={['Program', 'Courses', 'Actions']} caption="Programs">
            {list.data.rows.map((p) => (
              <tr key={p.ref}>
                <td>
                  <button
                    className="academic-text-button"
                    onClick={() => setSelected(p.ref)}
                  >
                    {p.title}
                  </button>
                </td>
                <td>{p.courses}</td>
                <td>
                  <button
                    className="admin-button secondary"
                    onClick={() => setEditor(p)}
                  >
                    Edit Program
                  </button>
                </td>
              </tr>
            ))}
          </Table>
          {!list.data.rows.length && (
            <p className="admin-empty">No Programs yet.</p>
          )}
          <Pager page={page} total={list.data.total} onPage={setPage} />
        </section>
      )}
      {selected && (
        <section className="admin-card">
          <h2>Courses in selected Program</h2>
          <State {...courses} />
          {courses.data?.rows.map((c) => (
            <p key={c.ref}>
              <Link href={adminHref(`/admin/courses/${c.ref}`)}>{c.title}</Link>{' '}
              · {c.published ? 'PUBLISHED' : 'DRAFT'}
            </p>
          ))}
          {courses.data && !courses.data.rows.length && (
            <p>No Courses in this Program.</p>
          )}
          <p className="admin-muted">
            First 20 Courses; use the catalog Program filter for pagination.
          </p>
        </section>
      )}
      {editor && (
        <TitleEditor
          kind="programs"
          initial={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={() => list.reload()}
        />
      )}
    </>
  );
}
export function AcademicActivities({
  assignments = false,
}: {
  assignments?: boolean;
}) {
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{assignments ? 'Assignments' : 'Assessments & Quizzes'}</h1>
          <p>Configure learning activities inside their Course and Section.</p>
        </div>
      </div>
      {assignments ? (
        <ActivityList assignments />
      ) : (
        <Tabs labels={['Activities', 'Question Banks']}>
          {(tab) =>
            tab === 'Activities' ? <ActivityList /> : <QuestionBankList />
          }
        </Tabs>
      )}
    </>
  );
}
function ActivityList({ assignments = false }: { assignments?: boolean }) {
  const [q, setQ] = useState(''),
    [page, setPage] = useState(1),
    [type, setType] = useState(assignments ? 'ASSIGNMENT' : 'QUIZ');
  const list = useAdminData<Activities>(
    `academic/activities?${new URLSearchParams({ q, page: String(page), type })}`,
  );
  return (
    <>
      <div className="academic-toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQ(String(new FormData(e.currentTarget).get('q') || ''));
            setPage(1);
          }}
        >
          <Field label="Search activities">
            <input name="q" maxLength={100} />
          </Field>
          {!assignments && (
            <Field label="Activity kind">
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
              >
                <option>QUIZ</option>
                <option>ASSESSMENT</option>
              </select>
            </Field>
          )}
          <button className="admin-button secondary">Search</button>
        </form>
        <Link className="admin-button" href={adminHref('/admin/courses')}>
          Open Course Builder
        </Link>
      </div>
      <State {...list} />
      {list.data && (
        <section className="admin-card academic-table">
          <Table
            headers={['Activity', 'Kind', 'Course', 'Status', 'Authoring']}
            caption="Academic activities"
          >
            {list.data.rows.map((i) => (
              <tr key={i.ref}>
                <td>{i.title}</td>
                <td>{i.type}</td>
                <td>{i.course}</td>
                <td>
                  <Pill>{i.published ? 'PUBLISHED' : 'DRAFT'}</Pill>
                </td>
                <td>
                  <Link
                    href={`${adminHref(`/admin/courses/${i.courseRef}`)}?section=${i.sectionRef}&item=${i.ref}`}
                  >
                    Edit configuration
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
          {!list.data.rows.length && (
            <p className="admin-empty">
              No matching activities. Add one from a Course Builder.
            </p>
          )}
          <Pager page={page} total={list.data.total} onPage={setPage} />
        </section>
      )}
    </>
  );
}
export function QuestionBankList() {
  const [page, setPage] = useState(1),
    [q, setQ] = useState(''),
    [editor, setEditor] = useState<
      { ref: string; title: string } | 'new' | null
    >(null),
    router = useRouter();
  const list = useAdminData<Banks>(
    `academic/banks?${new URLSearchParams({ page: String(page), q })}`,
  );
  return (
    <>
      <div className="academic-toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQ(String(new FormData(e.currentTarget).get('q') || ''));
            setPage(1);
          }}
        >
          <Field label="Search Question Banks">
            <input name="q" maxLength={100} />
          </Field>
          <button className="admin-button secondary">Search</button>
        </form>
        <button className="admin-button" onClick={() => setEditor('new')}>
          Create Question Bank
        </button>
      </div>
      <State {...list} />
      {list.data && (
        <section className="admin-card academic-table">
          <Table
            headers={['Question Bank', 'Questions', 'Actions']}
            caption="Question Banks"
          >
            {list.data.rows.map((b) => (
              <tr key={b.ref}>
                <td>
                  <Link href={adminHref(`/admin/question-banks/${b.ref}`)}>
                    {b.title}
                  </Link>
                </td>
                <td>{b.questions}</td>
                <td>
                  <button
                    className="admin-button secondary"
                    onClick={() => setEditor(b)}
                  >
                    Rename bank
                  </button>
                </td>
              </tr>
            ))}
          </Table>
          {!list.data.rows.length && (
            <p className="admin-empty">No Question Banks yet.</p>
          )}
          <Pager page={page} total={list.data.total} onPage={setPage} />
        </section>
      )}
      {editor && (
        <TitleEditor
          kind="banks"
          initial={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={(ref) => {
            list.reload();
            if (editor === 'new')
              router.push(adminHref(`/admin/question-banks/${ref}`));
          }}
        />
      )}
    </>
  );
}
