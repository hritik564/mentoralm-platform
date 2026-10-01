'use client';
import { useRouter } from 'next/navigation';
import { studentRequest } from '../../../lib/dashboard/student-client';
import { useState } from 'react';
import {
  ticketStatusLabels,
  type SupportTicket,
} from '../../../lib/dashboard/support';
import { DashboardPageHeader } from '../DashboardPageHeader';
import { DashboardIcon } from '../DashboardIcon';
import { TicketComposer } from './TicketComposer';
import { TicketDetail } from './TicketDetail';
export function TicketRow({
  ticket,
  onOpen,
}: {
  ticket: SupportTicket;
  onOpen: () => void;
}) {
  return (
    <li className="d3-ticket-row">
      <div>
        <p className="dashboard-eyebrow">
          {ticket.reference} · {ticket.category}
        </p>
        <h3>
          <button type="button" className="d3-ticket-link" onClick={onOpen}>
            {ticket.subject}
          </button>
        </h3>
        <p className="d3-muted">
          Updated{' '}
          <time dateTime={ticket.updatedAt}>
            {new Date(ticket.updatedAt).toLocaleDateString('en-US', {
              timeZone: 'UTC',
            })}
          </time>
        </p>
      </div>
      <span className="d3-badge">{ticketStatusLabels[ticket.status]}</span>
    </li>
  );
}
export function TicketList({
  tickets,
  onOpen,
}: {
  tickets: readonly SupportTicket[];
  onOpen: (ticket: SupportTicket) => void;
}) {
  return tickets.length ? (
    <ul className="d3-ticket-list">
      {tickets.map((ticket) => (
        <TicketRow
          key={ticket.id}
          ticket={ticket}
          onOpen={() => onOpen(ticket)}
        />
      ))}
    </ul>
  ) : (
    <div className="d3-empty">
      <span className="d3-surface-icon" aria-hidden="true">
        <DashboardIcon name="support" />
      </span>
      <h2>You don&apos;t have any support tickets yet.</h2>
      <p>Your requests and conversations with MentoraLM will appear here.</p>
    </div>
  );
}
export function SupportPage({
  tickets,
}: {
  tickets: readonly SupportTicket[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState('');
  async function openTicket(ticket: SupportTicket) {
    setNotice('Loading ticket…');
    try {
      setSelected(await studentRequest<SupportTicket>(`tickets/${ticket.id}`));
      setNotice('');
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Unable to open ticket.',
      );
    }
  }
  const [composing, setComposing] = useState(false);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  return (
    <section className="d3-page">
      <DashboardPageHeader
        title="Support"
        description="A clear place to ask for help and follow your requests."
      >
        <button className="d3-button" onClick={() => setComposing(true)}>
          Create Ticket <span aria-hidden="true">＋</span>
        </button>
      </DashboardPageHeader>
      <p role="status" className="d3-muted">
        {notice}
      </p>
      <section className="d3-panel" aria-labelledby="your-tickets-title">
        <h2 id="your-tickets-title">Your tickets</h2>
        <TicketList tickets={tickets} onOpen={openTicket} />
      </section>
      {composing && (
        <TicketComposer
          onClose={() => setComposing(false)}
          onCreated={() => {
            setComposing(false);
            setNotice('Ticket created.');
            router.refresh();
          }}
        />
      )}
      {selected && (
        <TicketDetail
          ticket={selected}
          onClose={() => {
            setSelected(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
