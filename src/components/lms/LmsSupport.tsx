'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { DashboardDialog } from '../dashboard/DashboardDialog';
import {
  supportCategories,
  ticketStatusLabels,
  validateTicketDraft,
  type SupportTicket,
  type TicketDraft,
  type TicketErrors,
} from '@/lib/dashboard/support';
import { lmsHref } from '@/lib/platform/domains';
import {
  LmsEmptyState,
  LmsIcon,
  LmsPageHeader,
  LmsStatusBadge,
} from './LmsPrimitives';
import { lmsAccountRequest } from './account-client';
function TicketStatus({ ticket }: { ticket: SupportTicket }) {
  const tone =
    ticket.status === 'resolved'
      ? 'success'
      : ticket.status === 'closed'
        ? 'neutral'
        : 'warning';
  return (
    <span className={`lms-status lms-status--${tone}`}>
      {ticketStatusLabels[ticket.status]}
    </span>
  );
}
function Updated({ value }: { value: string }) {
  return (
    <time dateTime={value}>
      {new Date(value).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
    </time>
  );
}
export function LmsSupport({ tickets }: { tickets: readonly SupportTicket[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <LmsPageHeader
        title="Support"
        description="Ask for help and follow your conversations with MentoraLM."
      >
        <button
          type="button"
          className="lms-action"
          onClick={() => setCreating(true)}
        >
          Create ticket +
        </button>
      </LmsPageHeader>
      {tickets.length ? (
        <ul
          className="lms-dense-list lms-support-list"
          aria-label="Your support tickets"
        >
          {tickets.map((ticket) => (
            <li className="lms-learning-row" key={ticket.id}>
              <span className="lms-row-icon">
                <LmsIcon name="support" />
              </span>
              <div className="lms-row-main">
                <p className="lms-muted">
                  {ticket.reference} · {ticket.category}
                </p>
                <h2>
                  <Link
                    href={lmsHref(`/learn/support/${ticket.id}`)}
                    prefetch={false}
                  >
                    {ticket.subject}
                  </Link>
                </h2>
                <p className="lms-muted">
                  Updated <Updated value={ticket.updatedAt} />
                </p>
              </div>
              <TicketStatus ticket={ticket} />
              <Link
                className="lms-secondary-action"
                href={lmsHref(`/learn/support/${ticket.id}`)}
                prefetch={false}
                aria-label={`Open ticket: ${ticket.subject}`}
              >
                Open →
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <LmsEmptyState
          title="No support tickets yet"
          description="Create a ticket when you need help. Your requests and conversations will appear here."
        />
      )}
      {creating && <TicketComposer onClose={() => setCreating(false)} />}
    </>
  );
}
export function TicketComposer({
  onClose,
  onCreated,
  request = lmsAccountRequest,
}: {
  onClose: () => void;
  onCreated?: () => void;
  request?: typeof lmsAccountRequest;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<TicketErrors>({});
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const form = useRef<HTMLFormElement>(null);
  return (
    <DashboardDialog
      title="Create support ticket"
      onClose={onClose}
      className="lms-dialog"
    >
      <form
        ref={form}
        className="lms-account-form"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          setNotice('');
          const fields = new FormData(event.currentTarget);
          const draft: TicketDraft = {
            category: String(fields.get('category')) as TicketDraft['category'],
            subject: String(fields.get('subject') || ''),
            message: String(fields.get('message') || ''),
          };
          const validation = validateTicketDraft(draft);
          setErrors(validation);
          if (Object.keys(validation).length) {
            form.current
              ?.querySelector<HTMLElement>(
                `[name="${Object.keys(validation)[0]}"]`,
              )
              ?.focus();
            return;
          }
          setBusy(true);
          try {
            const result = await request<{ id: string }>(
              'tickets',
              'POST',
              draft,
            );
            if (onCreated) {
              onCreated();
              return;
            }
            router.push(lmsHref(`/learn/support/${result.id}`));
            onClose();
            router.refresh();
          } catch (error) {
            setNotice(
              error instanceof Error
                ? error.message
                : 'Unable to create your ticket.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="lms-ticket-category">Category</label>
        <select id="lms-ticket-category" name="category" defaultValue="General">
          {supportCategories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <label htmlFor="lms-ticket-subject">Subject</label>
        <input
          id="lms-ticket-subject"
          name="subject"
          maxLength={120}
          required
          aria-invalid={!!errors.subject}
          aria-describedby={errors.subject ? 'lms-subject-error' : undefined}
        />
        {errors.subject && (
          <p className="lms-form-error" id="lms-subject-error">
            {errors.subject}
          </p>
        )}
        <label htmlFor="lms-ticket-message">Message</label>
        <textarea
          id="lms-ticket-message"
          name="message"
          rows={5}
          maxLength={4000}
          required
          aria-invalid={!!errors.message}
          aria-describedby="lms-message-hint lms-message-error"
        />
        <p className="lms-muted" id="lms-message-hint">
          Describe the issue. Do not include passwords or payment details.
        </p>
        <p className="lms-form-error" id="lms-message-error">
          {errors.message}
        </p>
        <p role="status">{notice}</p>
        <div className="lms-account-actions">
          <button className="lms-action" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Submit ticket'}
          </button>
          <button
            className="lms-secondary-action"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </DashboardDialog>
  );
}
export function LmsTicketConversation({ ticket }: { ticket: SupportTicket }) {
  const router = useRouter();
  const [reply, setReply] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const writable = ['open', 'in-progress'].includes(ticket.status);
  return (
    <>
      <LmsPageHeader
        title={ticket.subject}
        description={`${ticket.reference} · ${ticket.category}`}
      >
        <TicketStatus ticket={ticket} />
      </LmsPageHeader>
      <div className="lms-support-workspace">
        <section className="lms-panel" aria-label="Ticket conversation">
          <h2>Conversation</h2>
          <ol className="lms-ticket-messages">
            {ticket.messages.map((message) => (
              <li key={message.id} data-author={message.author}>
                <header>
                  <strong>
                    {message.author === 'student' ? 'You' : 'MentoraLM Support'}
                  </strong>
                  <Updated value={message.createdAt} />
                </header>
                <p>{message.body}</p>
              </li>
            ))}
          </ol>
          {writable ? (
            <form
              className="lms-account-form"
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                setNotice('');
                try {
                  await lmsAccountRequest(
                    `tickets/${ticket.id}/reply`,
                    'POST',
                    { message: reply },
                  );
                  setReply('');
                  setNotice('Reply saved.');
                  router.refresh();
                } catch (error) {
                  setNotice(
                    error instanceof Error
                      ? error.message
                      : 'Unable to send your reply.',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label htmlFor="lms-ticket-reply">Reply</label>
              <textarea
                id="lms-ticket-reply"
                rows={4}
                maxLength={4000}
                required
                value={reply}
                onChange={(event) => setReply(event.target.value)}
              />
              <p className="lms-muted">
                Do not include passwords or payment details.
              </p>
              <button
                className="lms-action"
                type="submit"
                disabled={busy || !reply.trim()}
              >
                {busy ? 'Sending…' : 'Send reply'}
              </button>
              <p role="status">{notice}</p>
            </form>
          ) : (
            <p className="lms-note">
              This ticket is {ticketStatusLabels[ticket.status].toLowerCase()}.
              Replies are unavailable.
            </p>
          )}
        </section>
        <aside className="lms-panel lms-support-summary">
          <h2>Request details</h2>
          <dl className="lms-profile-fields">
            <div>
              <dt>Reference</dt>
              <dd>{ticket.reference}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{ticket.category}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <TicketStatus ticket={ticket} />
              </dd>
            </div>
            <div>
              <dt>Last update</dt>
              <dd>
                <Updated value={ticket.updatedAt} />
              </dd>
            </div>
          </dl>
          <LmsStatusBadge status="Private conversation" />
        </aside>
      </div>
    </>
  );
}
