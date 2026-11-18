import 'server-only';
import { StudentError } from '../student/errors';
import { upstashCommand } from './upstash';

export type MarketplaceSnapshot = {
  epoch: string;
  generation: string;
  pending: number;
};
export type MarketplaceTicket = { epoch: string; token: string };
export interface MarketplaceGeneration {
  snapshot(): Promise<MarketplaceSnapshot | null>;
  begin(token: string): Promise<MarketplaceTicket>;
  commit(ticket: MarketplaceTicket): Promise<void>;
  abort(ticket: MarketplaceTicket): Promise<void>;
}
export type UpstashCommand = (command: readonly string[]) => Promise<unknown>;
export const MARKETPLACE_GENERATION_KEY =
  'mentoralm:production:marketplace:public:v2';
export const MARKETPLACE_PENDING_LIMIT = 64;
const MAX_GENERATION = '9223372036854775807';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const decimal = /^(?:0|[1-9][0-9]*)$/;

// Every operation uses primary-routed EVAL. State has no TTL: an uncertain write
// must keep readers on the authoritative database until an operator reconciles it.
const stateScript = `
local limit = ${MARKETPLACE_PENDING_LIMIT}
local maximum = '${MAX_GENERATION}'
local function valid_uuid(value)
  return type(value) == 'string' and #value == 36
    and string.match(value, '^[0-9a-f]+%-[0-9a-f]+%-[0-9a-f]+%-[0-9a-f]+%-[0-9a-f]+$')
    and string.sub(value, 9, 9) == '-' and string.sub(value, 14, 14) == '-'
    and string.sub(value, 19, 19) == '-' and string.sub(value, 24, 24) == '-'
end
local function valid_generation(value)
  if type(value) ~= 'string' then return false end
  if value ~= '0' and not string.match(value, '^[1-9][0-9]*$') then return false end
  return #value < #maximum or (#value == #maximum and value <= maximum)
end
local function load_state()
  if redis.call('EXISTS', KEYS[1]) == 0 then return nil, 'missing' end
  local kind = redis.call('TYPE', KEYS[1])
  if type(kind) == 'table' then kind = kind.ok end
  if kind ~= 'hash' or redis.call('PTTL', KEYS[1]) ~= -1 then return nil, 'invalid' end
  local epoch = redis.call('HGET', KEYS[1], 'epoch')
  local generation = redis.call('HGET', KEYS[1], 'generation')
  local raw_pending = redis.call('HGET', KEYS[1], 'pending')
  if not valid_uuid(epoch) or not valid_generation(generation)
    or type(raw_pending) ~= 'string'
    or (raw_pending ~= '0' and not string.match(raw_pending, '^[1-9][0-9]*$'))
    or #raw_pending > 2 then return nil, 'invalid' end
  local pending = tonumber(raw_pending)
  if pending > limit or redis.call('HLEN', KEYS[1]) ~= pending + 3 then return nil, 'invalid' end
  for _, field in ipairs(redis.call('HKEYS', KEYS[1])) do
    if field ~= 'epoch' and field ~= 'generation' and field ~= 'pending' then
      if string.sub(field, 1, 8) ~= 'pending:'
        or not valid_uuid(string.sub(field, 9))
        or redis.call('HGET', KEYS[1], field) ~= '1' then return nil, 'invalid' end
    end
  end
  return {epoch = epoch, generation = generation, pending = pending}, nil
end
`;

export const marketplaceGenerationScripts = {
  snapshot: `${stateScript}
if #ARGV ~= 0 then return {'invalid'} end
local state, failure = load_state()
if not state then return {failure} end
return {'ok', state.epoch, state.generation, state.pending}
`,
  begin: `${stateScript}
if #ARGV ~= 1 or not valid_uuid(ARGV[1]) then return {'invalid'} end
local state, failure = load_state()
if not state then return {failure} end
local field = 'pending:' .. ARGV[1]
if redis.call('HEXISTS', KEYS[1], field) == 0 then
  if state.pending >= limit then return {'invalid'} end
  redis.call('HSET', KEYS[1], field, '1')
  redis.call('HINCRBY', KEYS[1], 'pending', 1)
end
return {'ok', state.epoch, ARGV[1]}
`,
  commit: `${stateScript}
if #ARGV ~= 2 or not valid_uuid(ARGV[1]) or not valid_uuid(ARGV[2]) then return {'invalid'} end
local state, failure = load_state()
if not state then return {failure} end
if state.epoch ~= ARGV[1] then return {'invalid'} end
local field = 'pending:' .. ARGV[2]
if redis.call('HEXISTS', KEYS[1], field) == 1 then
  if state.generation == maximum then return {'invalid'} end
  redis.call('HINCRBY', KEYS[1], 'generation', 1)
  redis.call('HDEL', KEYS[1], field)
  redis.call('HINCRBY', KEYS[1], 'pending', -1)
end
return {'ok'}
`,
  abort: `${stateScript}
if #ARGV ~= 2 or not valid_uuid(ARGV[1]) or not valid_uuid(ARGV[2]) then return {'invalid'} end
local state, failure = load_state()
if not state then return {failure} end
if state.epoch ~= ARGV[1] then return {'invalid'} end
local field = 'pending:' .. ARGV[2]
if redis.call('HEXISTS', KEYS[1], field) == 1 then
  redis.call('HDEL', KEYS[1], field)
  redis.call('HINCRBY', KEYS[1], 'pending', -1)
end
return {'ok'}
`,
  initialize: `${stateScript}
if #ARGV ~= 2 or ARGV[1] ~= '' or not valid_uuid(ARGV[2]) then return {'invalid'} end
if redis.call('EXISTS', KEYS[1]) ~= 0 then return {'invalid'} end
redis.call('HSET', KEYS[1], 'epoch', ARGV[2], 'generation', '0', 'pending', '0')
return {'ok', ARGV[2], '0', 0}
`,
  reset: `${stateScript}
if #ARGV ~= 2 or not valid_uuid(ARGV[1]) or not valid_uuid(ARGV[2]) or ARGV[1] == ARGV[2] then return {'invalid'} end
local state, failure = load_state()
if not state then return {failure} end
if state.epoch ~= ARGV[1] or state.generation == maximum then return {'invalid'} end
redis.call('HINCRBY', KEYS[1], 'generation', 1)
local generation = redis.call('HGET', KEYS[1], 'generation')
for _, field in ipairs(redis.call('HKEYS', KEYS[1])) do
  if string.sub(field, 1, 8) == 'pending:' then redis.call('HDEL', KEYS[1], field) end
end
redis.call('HSET', KEYS[1], 'epoch', ARGV[2], 'pending', '0')
return {'ok', ARGV[2], generation, 0}
`,
} as const;

function validGeneration(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    decimal.test(value) &&
    (value.length < MAX_GENERATION.length ||
      (value.length === MAX_GENERATION.length && value <= MAX_GENERATION))
  );
}
function unavailable(): never {
  throw new StudentError('UNAVAILABLE');
}
function snapshotResult(value: unknown): MarketplaceSnapshot {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    value[0] !== 'ok' ||
    typeof value[1] !== 'string' ||
    !uuid.test(value[1]) ||
    !validGeneration(value[2]) ||
    typeof value[3] !== 'number' ||
    !Number.isInteger(value[3]) ||
    value[3] < 0 ||
    value[3] > MARKETPLACE_PENDING_LIMIT
  )
    unavailable();
  return { epoch: value[1], generation: value[2], pending: value[3] };
}

/** Shared publication authority; construction performs no environment/provider work. */
export class UpstashMarketplaceGeneration implements MarketplaceGeneration {
  constructor(private command: UpstashCommand = upstashCommand) {}

  private async execute(
    script: keyof typeof marketplaceGenerationScripts,
    args: string[] = [],
  ) {
    try {
      return await this.command([
        'EVAL',
        marketplaceGenerationScripts[script],
        '1',
        MARKETPLACE_GENERATION_KEY,
        ...args,
      ]);
    } catch {
      unavailable();
    }
  }
  async snapshot(): Promise<MarketplaceSnapshot | null> {
    const result = await this.execute('snapshot');
    if (Array.isArray(result) && result.length === 1 && result[0] === 'missing')
      return null;
    return snapshotResult(result);
  }
  async begin(token: string): Promise<MarketplaceTicket> {
    if (typeof token !== 'string' || !uuid.test(token)) unavailable();
    const result = await this.execute('begin', [token]);
    if (
      !Array.isArray(result) ||
      result.length !== 3 ||
      result[0] !== 'ok' ||
      typeof result[1] !== 'string' ||
      !uuid.test(result[1]) ||
      result[2] !== token
    )
      unavailable();
    return { epoch: result[1], token };
  }
  private async finish(action: 'commit' | 'abort', ticket: MarketplaceTicket) {
    if (
      !ticket ||
      typeof ticket.epoch !== 'string' ||
      !uuid.test(ticket.epoch) ||
      typeof ticket.token !== 'string' ||
      !uuid.test(ticket.token)
    )
      unavailable();
    const result = await this.execute(action, [ticket.epoch, ticket.token]);
    if (!Array.isArray(result) || result.length !== 1 || result[0] !== 'ok')
      unavailable();
  }
  commit(ticket: MarketplaceTicket): Promise<void> {
    return this.finish('commit', ticket);
  }
  abort(ticket: MarketplaceTicket): Promise<void> {
    return this.finish('abort', ticket);
  }

  /** Maintenance only: callers must drain writes and verify quiescence first. */
  async initializeAfterQuiescence(
    expectedEpoch: null,
    newEpoch: string,
  ): Promise<MarketplaceSnapshot> {
    if (
      expectedEpoch !== null ||
      typeof newEpoch !== 'string' ||
      !uuid.test(newEpoch)
    )
      unavailable();
    return snapshotResult(await this.execute('initialize', ['', newEpoch]));
  }
  /** Maintenance only: an epoch CAS prevents resetting state observed elsewhere. */
  async resetAfterQuiescence(
    expectedEpoch: string,
    newEpoch: string,
  ): Promise<MarketplaceSnapshot> {
    if (
      typeof expectedEpoch !== 'string' ||
      !uuid.test(expectedEpoch) ||
      typeof newEpoch !== 'string' ||
      !uuid.test(newEpoch) ||
      expectedEpoch === newEpoch
    )
      unavailable();
    return snapshotResult(
      await this.execute('reset', [expectedEpoch, newEpoch]),
    );
  }
}
