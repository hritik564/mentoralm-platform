'use client';
import { useRef, useState } from 'react';
import {
  supportCategories,
  supportService,
  validateTicketDraft,
  type TicketDraft,
  type TicketErrors,
} from '../../../lib/dashboard/support';
import { DashboardDialog } from '../DashboardDialog';
export function TicketComposer({ onClose }: { onClose: () => void }) {
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
        Ticket submission is in development. Nothing you enter here is sent or
        saved.
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
            await supportService.createTicket(draft);
            setNotice(
              'Ticket submission is not available yet. Your ticket has not been sent or saved.',
            );
          } catch {
            setNotice('Unable to submit. No ticket has been saved.');
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
