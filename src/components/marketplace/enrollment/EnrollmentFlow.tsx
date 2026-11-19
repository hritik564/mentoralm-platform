'use client';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type {
  EnrollmentView,
  OnboardingValues,
} from '@/lib/marketplace/enrollment/types';
import {
  currentStatuses,
  educationLevels,
} from '@/lib/marketplace/enrollment/types';
import { onboardingStepInput } from '@/lib/marketplace/enrollment/validation';
import {
  Details,
  Quote,
  Unavailable,
  type Identity,
} from './EnrollmentSummary';
const names = ['About you', 'Education & status', 'Your goal', 'Review'];
const labels = {
  fullName: 'Full name',
  phone: 'Phone (with country code)',
  city: 'City',
  region: 'State / region',
  country: 'Country',
  institution: 'Institution / organization (optional)',
  goal: 'What would you like to achieve?',
  source: 'How did you find us? (optional)',
};
const friendly = (s: string) =>
  s
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (v) => v.toUpperCase());
export function EnrollmentFlow({
  view: initial,
  identity,
}: {
  view: EnrollmentView;
  identity: Identity;
}) {
  const router = useRouter();
  const [view, setView] = useState(initial),
    [step, setStep] = useState(Math.min(initial.completedStep + 1, 4)),
    [values, setValues] = useState<OnboardingValues>({
      ...initial.values,
      fullName: initial.values.fullName || identity.name,
      phone: initial.values.phone || identity.phone,
    }),
    [consent, setConsent] = useState(false),
    [pending, setPending] = useState(initial.needsClaim),
    [error, setError] = useState(''),
    [errors, setErrors] = useState<Record<string, string>>({});
  const claimStarted = useRef(false),
    heading = useRef<HTMLHeadingElement>(null),
    summary = useRef<HTMLDivElement>(null);
  const mutate = useCallback(
    async (action: string, body: unknown) => {
      const response = await fetch(
        `/api/marketplace/enrollment/${initial.ref}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || 'Please reload and try again.');
      return data as EnrollmentView;
    },
    [initial.ref],
  );
  useEffect(() => {
    if (
      !initial.needsClaim ||
      initial.access !== 'active' ||
      claimStarted.current
    )
      return;
    claimStarted.current = true;
    void mutate('claim', { revision: initial.revision })
      .then((next) => {
        if (next.ref !== initial.ref) {
          router.replace(`/enroll/${next.ref}`);
          return;
        }
        setView(next);
        setValues((old) => ({
          ...next.values,
          fullName: next.values.fullName || old.fullName,
          phone: next.values.phone || old.phone,
        }));
      })
      .catch((e) => setError(e.message))
      .finally(() => setPending(false));
  }, [initial, mutate, router]);
  function go(next: number) {
    setStep(next);
    setErrors({});
    setError('');
    setConsent(false);
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const fields =
      step === 1
        ? {
            fullName: values.fullName,
            phone: values.phone,
            city: values.city,
            region: values.region,
            country: values.country,
          }
        : step === 2
          ? {
              educationLevel: values.educationLevel,
              currentStatus: values.currentStatus,
              institution: values.institution,
            }
          : step === 3
            ? { goal: values.goal, source: values.source }
            : { consent };
    const input = { ...fields, step, revision: view.revision };
    const parsed = onboardingStepInput.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        next[key] =
          key === 'consent'
            ? 'Please confirm your enrollment details.'
            : key === 'phone'
              ? 'Enter a valid international phone number, such as +919876543210.'
              : 'Please check this field. Use plain text within the stated limit.';
      }
      setErrors(next);
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const next = await mutate('steps', parsed.data);
      setView(next);
      setValues(next.values);
      if (step === 4) router.push(`/checkout/${view.ref}`);
      else go(step + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please reload to continue.');
      requestAnimationFrame(() => summary.current?.focus());
    } finally {
      setPending(false);
    }
  }
  function field(key: keyof typeof labels, max: number, textarea = false) {
    return (
      <div
        className={
          textarea
            ? 'enrollment-field enrollment-field--wide'
            : 'enrollment-field'
        }
        key={key}
      >
        <label htmlFor={key}>{labels[key]}</label>
        {textarea ? (
          <textarea
            id={key}
            maxLength={max}
            rows={5}
            value={values[key] || ''}
            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            aria-invalid={!!errors[key]}
            aria-describedby={errors[key] ? `${key}-error` : undefined}
          />
        ) : (
          <input
            id={key}
            type={key === 'phone' ? 'tel' : 'text'}
            autoComplete={
              (
                {
                  fullName: 'name',
                  phone: 'tel',
                  city: 'address-level2',
                  region: 'address-level1',
                  country: 'country-name',
                  institution: 'organization',
                } as Record<string, string>
              )[key]
            }
            maxLength={max}
            value={values[key] || ''}
            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            aria-invalid={!!errors[key]}
            aria-describedby={errors[key] ? `${key}-error` : undefined}
          />
        )}
        <small>
          {max} characters maximum
          {key === 'institution' || key === 'source' ? ' · Optional' : ''}
        </small>
        {errors[key] && (
          <span className="enrollment-error" id={`${key}-error`}>
            {errors[key]}
          </span>
        )}
      </div>
    );
  }
  function select(
    key: 'educationLevel' | 'currentStatus',
    label: string,
    options: readonly string[],
  ) {
    return (
      <div className="enrollment-field">
        <label htmlFor={key}>{label}</label>
        <select
          id={key}
          value={values[key] || ''}
          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `${key}-error` : undefined}
        >
          <option value="">Select an option</option>
          {options.map((v) => (
            <option value={v} key={v}>
              {friendly(v)}
            </option>
          ))}
        </select>
        {errors[key] && (
          <span className="enrollment-error" id={`${key}-error`}>
            {errors[key]}
          </span>
        )}
      </div>
    );
  }
  if (view.access !== 'active') return <Unavailable view={view} />;
  return (
    <>
      <header className="enrollment-heading">
        <p className="enrollment-eyebrow">
          A little about you. A clearer way forward.
        </p>
        <h1>Make this your next chapter</h1>
        <p>
          Confirm a few details for your program. Completed steps are saved
          securely.
        </p>
      </header>
      <div className="enrollment-layout">
        <section className="enrollment-card">
          <ol className="enrollment-progress" aria-label="Enrollment progress">
            {names.map((name, i) => (
              <li key={name} aria-current={step === i + 1 ? 'step' : undefined}>
                <button
                  type="button"
                  disabled={
                    pending || view.needsClaim || i > view.completedStep
                  }
                  onClick={() => go(i + 1)}
                >
                  <span>{i + 1}</span>
                  {name}
                </button>
              </li>
            ))}
          </ol>
          <form onSubmit={submit} noValidate>
            <p className="enrollment-eyebrow">Step {step} of 4</p>
            <h2 ref={heading} tabIndex={-1}>
              {names[step - 1]}
            </h2>
            <p className="enrollment-account">Signed in as {identity.email}</p>
            {(error || Object.keys(errors).length > 0) && (
              <div
                ref={summary}
                className="enrollment-error-summary"
                role="alert"
                tabIndex={-1}
              >
                {error || 'Please review the highlighted fields.'}
                {Object.keys(errors).map((key) => (
                  <a key={key} href={`#${key}`}>
                    {key === 'consent' ? 'Confirm details' : friendly(key)}:{' '}
                    {errors[key]}
                  </a>
                ))}
                {view.needsClaim && error && (
                  <a href={`/enroll/${view.ref}`}>
                    Reload to retry secure account confirmation
                  </a>
                )}
              </div>
            )}
            <fieldset
              disabled={pending || view.needsClaim}
              className="enrollment-fields"
            >
              <legend className="sr-only">{names[step - 1]}</legend>
              {step === 1 && (
                <>
                  {field('fullName', 120)}
                  {field('phone', 32)}
                  {field('city', 100)}
                  {field('region', 100)}
                  {field('country', 80)}
                  <p className="enrollment-field--wide">
                    These details are for this enrollment. Confirm your name and
                    phone for program communication; your account profile is
                    unchanged.
                  </p>
                </>
              )}
              {step === 2 && (
                <>
                  {select('educationLevel', 'Education level', educationLevels)}
                  {select('currentStatus', 'Current status', currentStatuses)}
                  {field('institution', 160)}
                </>
              )}
              {step === 3 && (
                <>
                  {field('goal', 1500, true)}
                  {field('source', 200)}
                </>
              )}
              {step === 4 && (
                <div className="enrollment-field--wide">
                  <Details view={{ ...view, values }} />
                  <label className="enrollment-consent" htmlFor="consent">
                    <input
                      id="consent"
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      aria-invalid={!!errors.consent}
                      aria-describedby={
                        errors.consent ? 'consent-error' : undefined
                      }
                    />
                    I confirm these details are accurate and agree that
                    MentoraLM may use them to process this enrollment and
                    communicate about the selected program.
                  </label>
                  {errors.consent && (
                    <p className="enrollment-error" id="consent-error">
                      {errors.consent}
                    </p>
                  )}
                  <p>
                    This confirms your enrollment details only. It does not take
                    payment or grant course access.
                  </p>
                </div>
              )}
            </fieldset>
            <div className="enrollment-form-actions">
              {step > 1 && (
                <button
                  type="button"
                  className="enrollment-secondary"
                  disabled={pending}
                  onClick={() => go(step - 1)}
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                className="enrollment-primary"
                disabled={pending || view.needsClaim}
              >
                {pending
                  ? 'Saving…'
                  : step === 4
                    ? 'Review checkout summary'
                    : 'Save & continue'}
              </button>
            </div>
          </form>
        </section>
        <Quote view={view} />
      </div>
    </>
  );
}
