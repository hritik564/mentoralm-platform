'use client';
import { useState } from 'react';
import {
  supportService,
  ticketStatusLabels,
  type SupportMessage,
  type SupportTicket,
} from '../../../lib/dashboard/support';
import { DashboardDialog } from '../DashboardDialog';
export function TicketConversation({
  messages,
}: {
  messages: readonly SupportMessage[];
}) {
  return (
    <ol className="d3-conversation" aria-label="Ticket conversation">
      {messages.map((message) => (
        <li key={message.id}>
          <div>
            <strong>
              {message.author === 'student' ? 'You' : 'MentoraLM Support'}
            </strong>
            <time dateTime={message.createdAt}>
              {new Date(message.createdAt).toLocaleDateString('en-US', {
                timeZone: 'UTC',
              })}
            </time>
          </div>
          <p>{message.body}</p>
        </li>
      ))}
    </ol>
  );
}
export function TicketDetail({
  ticket,
  onClose,
}: {
  ticket: SupportTicket;
  onClose: () => void;
}) {
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const writable = ticket.status === 'open' || ticket.status === 'in-progress';
  return (
    <DashboardDialog title={ticket.subject} onClose={onClose}>
      <p className="d3-muted">
        {ticket.reference} · {ticket.category} ·{' '}
        {ticketStatusLabels[ticket.status]}
      </p>
      <TicketConversation messages={ticket.messages} />
      {writable ? (
        <form
          className="d3-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await supportService.reply(ticket.id, reply);
              setNotice(
                'Replies are not available yet. Nothing has been sent or saved.',
              );
            } catch {
              setNotice('Unable to send. No reply has been saved.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="ticket-reply">Reply</label>
          <textarea
            id="ticket-reply"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            required
            maxLength={4000}
            rows={4}
          />
          <p className="d3-muted">
            Replies are in development. Do not include sensitive information.
          </p>
          <button
            className="d3-button"
            disabled={busy || !reply.trim()}
            type="submit"
          >
            Send reply
          </button>
          <p role="status">{notice}</p>
        </form>
      ) : (
        <p className="d3-notice">
          This ticket is {ticketStatusLabels[ticket.status].toLowerCase()}.
          Replies are unavailable.
        </p>
      )}
    </DashboardDialog>
  );
}
