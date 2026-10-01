'use client';
import { useRef, useState } from 'react';
import {
  supportCategories,
  validateTicketDraft,
  type TicketDraft,
  type TicketErrors,
} from '../../../lib/dashboard/support';
import { studentRequest } from '../../../lib/dashboard/student-client';
import { DashboardDialog } from '../DashboardDialog';
export function TicketComposer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [draft, setDraft] = useState<TicketDraft>({
    category: 'General',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<TicketErrors>({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  return (
    <DashboardDialog title="Create Ticket" onClose={onClose}>
      <p className="d3-notice">
        Send a request to MentoraLM Support. Do not include passwords or payment
        details.
      </p>
      <form
        className="d3-form"
        ref={form}
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          setNotice('');
          const next = validateTicketDraft(draft);
          setErrors(next);
          if (Object.keys(next).length) {
            const field = Object.keys(next)[0];
            form.current
              ?.querySelector<HTMLElement>(`[name="${field}"]`)
              ?.focus();
            return;
          }
          setBusy(true);
          try {
            await studentRequest('tickets', 'POST', draft);
            onCreated();
          } catch (error) {
            setNotice(
              error instanceof Error
                ? error.message
                : 'Unable to submit. Please try again.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="ticket-category">Category</label>
        <select
          id="ticket-category"
          name="category"
          value={draft.category}
          aria-invalid={Boolean(errors.category)}
          aria-describedby={errors.category ? 'category-error' : undefined}
          onChange={(event) =>
            setDraft({
              ...draft,
              category: event.target.value as TicketDraft['category'],
            })
          }
        >
          {supportCategories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        {errors.category && (
          <p id="category-error" className="d3-error">
            {errors.category}
          </p>
        )}
        <label htmlFor="ticket-subject">Subject</label>
        <input
          id="ticket-subject"
          name="subject"
          value={draft.subject}
          maxLength={120}
          required
          aria-invalid={Boolean(errors.subject)}
          aria-describedby={errors.subject ? 'subject-error' : undefined}
          onChange={(event) =>
            setDraft({ ...draft, subject: event.target.value })
          }
        />
        {errors.subject && (
          <p id="subject-error" className="d3-error">
            {errors.subject}
          </p>
        )}
        <label htmlFor="ticket-message">Message</label>
        <p id="ticket-message-hint" className="d3-muted">
          Describe the issue. Do not include passwords or payment details.
        </p>
        <textarea
          id="ticket-message"
          name="message"
          rows={5}
          maxLength={4000}
          required
          value={draft.message}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={`ticket-message-hint${errors.message ? ' message-error' : ''}`}
          onChange={(event) =>
            setDraft({ ...draft, message: event.target.value })
          }
        />
        {errors.message && (
          <p id="message-error" className="d3-error">
            {errors.message}
          </p>
        )}
        <p role="status">{notice}</p>
        <div className="d3-actions">
          <button className="d3-button" disabled={busy} type="submit">
            {busy ? 'Checking…' : 'Submit ticket'}
          </button>
          <button className="d3-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </DashboardDialog>
  );
}
