'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Attempts } from '@/lib/lms/attempts';
type Activity = Awaited<ReturnType<Attempts['view']>>;
type Attempt = Activity['attempts'][number];
export function AttemptPlayer({
  activity,
  courseId,
}: {
  activity: Activity;
  courseId: string;
}) {
  const [attempt, setAttempt] = useState<Attempt | null>(
      activity.attempts.find((a) => a.status === 'IN_PROGRESS') ||
        activity.attempts[0] ||
        null,
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [questionIndex, setQuestionIndex] = useState(0);
  const feedback = useRef<HTMLParagraphElement>(null);
  const result = useRef<HTMLDivElement>(null),
    router = useRouter();
  useEffect(() => {
    if (attempt?.status === 'SUBMITTED') result.current?.focus();
  }, [attempt?.status]);
  const failed =
    message.startsWith('Answer questions') || message.includes('could not');
  useEffect(() => {
    if (failed) feedback.current?.focus();
  }, [failed, message]);
  const base = `/api/lms/academic/courses/${courseId}/activities/${activity.id}`;
  async function post(path: string, body: unknown) {
    const r = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw Error();
    return (await r.json()) as Attempt;
  }
  async function start() {
    setBusy(true);
    setQuestionIndex(0);
    setMessage('');
    try {
      setAttempt(await post('/start', {}));
      router.refresh();
    } catch {
      setMessage(
        'An attempt could not be started. Check your access or attempt limit.',
      );
    } finally {
      setBusy(false);
    }
  }
  function update(
    questionId: string,
    patch: Partial<Attempt['questions'][number]>,
  ) {
    setAttempt((a) =>
      a
        ? {
            ...a,
            questions: a.questions.map((q) =>
              q.id === questionId ? { ...q, ...patch } : q,
            ),
          }
        : a,
    );
  }
  async function save(submit: boolean) {
    if (!attempt) return;
    const missing = attempt.questions.flatMap((q, i) =>
      ['SHORT_TEXT', 'LONG_TEXT'].includes(q.type)
        ? !q.text.trim()
          ? [i + 1]
          : []
        : !q.optionIds.length
          ? [i + 1]
          : [],
    );
    if (submit && missing.length) {
      setMessage(`Answer questions ${missing.join(', ')} before submitting.`);
      return;
    }
    if (
      submit &&
      !window.confirm(
        'Submit this attempt? Submitted answers cannot be changed.',
      )
    )
      return;
    setBusy(true);
    setMessage('');
    try {
      const answers = attempt.questions.map((q) =>
        ['SHORT_TEXT', 'LONG_TEXT'].includes(q.type)
          ? { questionId: q.id, text: q.text }
          : { questionId: q.id, optionIds: q.optionIds },
      );
      const saved = await post(`/attempts/${attempt.id}/save`, { answers });
      setAttempt(
        submit ? await post(`/attempts/${attempt.id}/submit`, {}) : saved,
      );
      setMessage(
        submit
          ? 'Attempt submitted.'
          : 'Answers saved. You can resume this attempt later.',
      );
      router.refresh();
    } catch {
      setMessage(
        'Answers could not be saved or submitted. Answer every question before submitting and check your access.',
      );
    } finally {
      setBusy(false);
    }
  }
  const submitted = attempt?.status === 'SUBMITTED';
  return (
    <div className="l3-attempt">
      <p className="lms-eyebrow">
        {activity.kind.toLowerCase()} ·{' '}
        {activity.attemptLimit
          ? `${activity.attemptLimit} attempt limit`
          : 'Up to 100 attempts'}
      </p>
      <p className="l3-text">{activity.instructions}</p>
      {activity.passingPercent !== null && (
        <p>Passing threshold: {activity.passingPercent}%</p>
      )}
      {!attempt && (
        <button className="lms-action" disabled={busy} onClick={start}>
          Start {activity.kind.toLowerCase()}
        </button>
      )}
      {attempt && (
        <>
          <p>
            Attempt {attempt.number} · {submitted ? 'Submitted' : 'In progress'}
          </p>
          {submitted && (
            <div className="l3-result" tabIndex={-1} ref={result}>
              <h3>Attempt result</h3>
              <p>
                {attempt.score}/{attempt.maxScore} points · {attempt.percentage}
                %
                {attempt.passed !== null &&
                  ` · ${attempt.passed ? 'Passed' : 'Not passed'}`}
              </p>
              {attempt.requiresReview && (
                <p>
                  Text answers require review. These are objective points so
                  far, not a final graded result.
                </p>
              )}
              <p>
                {activity.kind === 'ASSESSMENT'
                  ? 'Assessment responses are recorded. No personal or career interpretation is generated.'
                  : 'Your responses have been recorded.'}
              </p>
            </div>
          )}
          {!submitted && (
            <div className="lms-question-progress">
              <span role="status">
                Question {Math.min(questionIndex + 1, attempt.questions.length)}{' '}
                of {attempt.questions.length}
              </span>
              <progress
                aria-label="Question navigation progress"
                value={questionIndex + 1}
                max={attempt.questions.length}
              />
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(false);
            }}
          >
            <fieldset disabled={busy || submitted}>
              <legend className="sr-only">Attempt answers</legend>
              {attempt.questions.map((q, index) => (
                <fieldset
                  className="l3-question"
                  key={q.id}
                  hidden={!submitted && index !== questionIndex}
                >
                  <legend>
                    <span>{index + 1}.</span> {q.prompt}
                  </legend>
                  {['SHORT_TEXT', 'LONG_TEXT'].includes(q.type) ? (
                    <>
                      <label htmlFor={`answer-${q.id}`}>Your answer</label>
                      <textarea
                        id={`answer-${q.id}`}
                        maxLength={12000}
                        rows={q.type === 'LONG_TEXT' ? 6 : 2}
                        value={q.text}
                        onChange={(e) => update(q.id, { text: e.target.value })}
                      />
                    </>
                  ) : (
                    q.options.map((o) => (
                      <label className="l3-choice" key={o.id}>
                        <input
                          type={
                            q.type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'
                          }
                          name={`answer-${q.id}`}
                          checked={q.optionIds.includes(o.id)}
                          onChange={(e) =>
                            update(q.id, {
                              optionIds:
                                q.type === 'MULTIPLE_CHOICE'
                                  ? e.target.checked
                                    ? [...q.optionIds, o.id]
                                    : q.optionIds.filter((id) => id !== o.id)
                                  : [o.id],
                            })
                          }
                        />
                        <span>{o.label}</span>
                      </label>
                    ))
                  )}
                </fieldset>
              ))}
            </fieldset>
            {!submitted && (
              <div className="l3-form-actions">
                <button
                  type="button"
                  disabled={busy || questionIndex === 0}
                  onClick={() => setQuestionIndex((i) => i - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={
                    busy || questionIndex >= attempt.questions.length - 1
                  }
                  onClick={() => setQuestionIndex((i) => i + 1)}
                >
                  Next question
                </button>
                <button type="submit" disabled={busy}>
                  Save answers
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  Submit attempt
                </button>
              </div>
            )}
          </form>
          {submitted && attempt.questions.some((q) => 'explanation' in q) && (
            <section className="l3-review">
              <h3>Answer review</h3>
              {attempt.questions.map((q, i) => (
                <div key={q.id}>
                  <h4>Question {i + 1}</h4>
                  <p>
                    {q.awardedPoints === null
                      ? 'Requires review'
                      : `${q.awardedPoints}/${q.points} points`}
                  </p>
                  {q.options
                    .filter((o) => o.correct)
                    .map((o) => (
                      <p key={o.id}>Correct answer: {o.label}</p>
                    ))}
                  {q.explanation && <p>{q.explanation}</p>}
                </div>
              ))}
            </section>
          )}
          {submitted && activity.canStart && (
            <button className="lms-action" disabled={busy} onClick={start}>
              Start another attempt
            </button>
          )}
        </>
      )}
      <p
        ref={feedback}
        tabIndex={-1}
        role={failed ? 'alert' : 'status'}
        className="l2-feedback"
      >
        {message}
      </p>
      {activity.attempts.length > 0 && (
        <details className="l3-history">
          <summary>Attempt history ({activity.attempts.length})</summary>
          <ol>
            {activity.attempts.map((a) => (
              <li key={a.id}>
                Attempt {a.number} · {a.status.replace('_', ' ').toLowerCase()}
                {a.percentage !== null && ` · ${a.percentage}%`}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
