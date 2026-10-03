import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
} from 'node:crypto';
import { StudentError } from '../student/errors';
export type HandleKind =
  | 'student'
  | 'batch'
  | 'course'
  | 'program'
  | 'instructor'
  | 'item'
  | 'session'
  | 'section'
  | 'bank'
  | 'question'
  | 'attempt'
  | 'response'
  | 'submission'
  | 'version'
  | 'file'
  | 'certificate'
  | 'thread'
  | 'ticket'
  | 'message'
  | 'membership';
function key() {
  if (!process.env.CLERK_SECRET_KEY) throw new StudentError('UNAVAILABLE');
  return createHash('sha256')
    .update(`mentoralm-admin-handles:${process.env.CLERK_SECRET_KEY}`)
    .digest();
}
/** Opaque routing references hide internal IDs. They never substitute for persisted-role authorization. */
export function adminHandle(kind: HandleKind, id: string) {
  const iv = createHmac(
      'sha256',
      createHmac('sha256', key()).update('nonce-key').digest(),
    )
      .update(`routing-nonce:${kind}:${id}`)
      .digest()
      .subarray(0, 12),
    cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([
    cipher.update(`${kind}:${id}`, 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function adminId(kind: HandleKind, value: string) {
  try {
    if (!/^[a-zA-Z0-9_-]{35,500}$/.test(value)) throw Error();
    const buffer = Buffer.from(value, 'base64url'),
      decipher = createDecipheriv('aes-256-gcm', key(), buffer.subarray(0, 12));
    decipher.setAuthTag(buffer.subarray(12, 28));
    const plain = Buffer.concat([
      decipher.update(buffer.subarray(28)),
      decipher.final(),
    ]).toString();
    if (!plain.startsWith(`${kind}:`)) throw Error();
    const id = plain.slice(kind.length + 1);
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw Error();
    return id;
  } catch {
    throw new StudentError('NOT_FOUND');
  }
}
