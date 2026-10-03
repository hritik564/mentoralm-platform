import 'server-only';
import { logRecord, type LogEvent, type LogContext } from './log-record';
import { BetterStackTransport } from './better-stack';
export { logRecord, safeRoute } from './log-record';
export type { LogEvent, LogContext } from './log-record';
const transport = new BetterStackTransport();
export function log(
  level: 'info' | 'warn' | 'error',
  event: LogEvent,
  context: LogContext = {},
) {
  const record = logRecord(level, event, context);
  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
  transport.emit(record);
}
