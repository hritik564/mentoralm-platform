'use client';
import { useState } from 'react';
import {
  ticketStatusLabels,
  type SupportMessage,
  type SupportTicket,
} from '../../../lib/dashboard/support';
import { studentRequest } from '../../../lib/dashboard/student-client';
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
  const [currentTicket, setCurrentTicket] = useState(ticket);
  const [reply, setReply] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const writable =
    currentTicket.status === 'open' || currentTicket.status === 'in-progress';
  return (
    <DashboardDialog title={ticket.subject} onClose={onClose}>
      <p className="d3-muted">
        {ticket.reference} · {ticket.category} ·{' '}
        {ticketStatusLabels[currentTicket.status]}
      </p>
      <TicketConversation messages={currentTicket.messages} />
      {writable ? (
        <form
          className="d3-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await studentRequest(`tickets/${ticket.id}/reply`, 'POST', {
                message: reply,
              });
              setReply('');
              setNotice('Reply saved.');
              try {
                setCurrentTicket(
                  await studentRequest<SupportTicket>(`tickets/${ticket.id}`),
                );
              } catch {
                setNotice(
                  'Reply saved. Close and reopen the ticket to refresh its conversation.',
                );
              }
            } catch (error) {
              setNotice(
                error instanceof Error
                  ? error.message
                  : 'Unable to send. Please try again.',
              );
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
            Do not include passwords or payment details.
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
          This ticket is{' '}
          {ticketStatusLabels[currentTicket.status].toLowerCase()}. Replies are
          unavailable.
        </p>
      )}
    </DashboardDialog>
  );
}
