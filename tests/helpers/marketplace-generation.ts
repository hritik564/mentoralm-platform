import assert from 'node:assert/strict';
import {
  MARKETPLACE_GENERATION_KEY,
  MARKETPLACE_PENDING_LIMIT,
  marketplaceGenerationScripts,
  type UpstashCommand,
} from '../../src/lib/production/marketplace-generation';

/** Contract emulator for injected provider tests. No credentials, endpoint or network. */
export class TestMarketplaceRedis {
  hash: Map<string, string> | null = null;
  ttl = -1;
  failNext: 'before' | 'after' | null = null;
  readonly calls: (readonly string[])[] = [];
  readonly command: UpstashCommand = async (command) => {
    this.calls.push(command);
    assert.equal(command[0], 'EVAL');
    assert.equal(command[2], '1');
    assert.equal(command[3], MARKETPLACE_GENERATION_KEY);
    const action = Object.entries(marketplaceGenerationScripts).find(
      ([, script]) => script === command[1],
    )?.[0];
    assert.ok(action, 'only the production scripts may execute');
    const failure = this.failNext;
    this.failNext = null;
    if (failure === 'before') throw Error('Injected command failure.');
    const result = this.execute(action, command.slice(4));
    if (failure === 'after')
      throw Error('Injected lost command acknowledgment.');
    return result;
  };

  private state() {
    if (!this.hash) return null;
    const epoch = this.hash.get('epoch');
    const generation = this.hash.get('generation');
    const pending = this.hash.get('pending');
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    if (
      !epoch ||
      !uuid.test(epoch) ||
      !generation ||
      !/^(?:0|[1-9][0-9]*)$/.test(generation) ||
      BigInt(generation) > BigInt('9223372036854775807') ||
      !pending ||
      !/^(?:0|[1-9][0-9]*)$/.test(pending) ||
      Number(pending) > MARKETPLACE_PENDING_LIMIT ||
      this.ttl !== -1 ||
      this.hash.size !== Number(pending) + 3
    )
      return false;
    for (const [field, value] of this.hash) {
      if (['epoch', 'generation', 'pending'].includes(field)) continue;
      if (
        !field.startsWith('pending:') ||
        !uuid.test(field.slice(8)) ||
        value !== '1'
      )
        return false;
    }
    return { epoch, generation, pending: Number(pending) };
  }
  private execute(action: string, args: readonly string[]): unknown {
    if (action === 'initialize') {
      if (this.hash || args.length !== 2 || args[0] !== '') return ['invalid'];
      this.hash = new Map([
        ['epoch', args[1]],
        ['generation', '0'],
        ['pending', '0'],
      ]);
      this.ttl = -1;
      return ['ok', args[1], '0', 0];
    }
    const state = this.state();
    if (state === null) return ['missing'];
    if (state === false) return ['invalid'];
    const hash = this.hash!;
    if (action === 'snapshot')
      return ['ok', state.epoch, state.generation, state.pending];
    if (action === 'begin') {
      const field = `pending:${args[0]}`;
      if (!hash.has(field)) {
        if (state.pending === MARKETPLACE_PENDING_LIMIT) return ['invalid'];
        hash.set(field, '1');
        hash.set('pending', String(state.pending + 1));
      }
      return ['ok', state.epoch, args[0]];
    }
    if (state.epoch !== args[0]) return ['invalid'];
    if (action === 'reset') {
      if (state.epoch === args[1] || state.generation === '9223372036854775807')
        return ['invalid'];
      const generation = String(BigInt(state.generation) + BigInt(1));
      this.hash = new Map([
        ['epoch', args[1]],
        ['generation', generation],
        ['pending', '0'],
      ]);
      return ['ok', args[1], generation, 0];
    }
    const field = `pending:${args[1]}`;
    if (hash.has(field)) {
      if (action === 'commit') {
        if (state.generation === '9223372036854775807') return ['invalid'];
        hash.set('generation', String(BigInt(state.generation) + BigInt(1)));
      } else assert.equal(action, 'abort');
      hash.delete(field);
      hash.set('pending', String(state.pending - 1));
    }
    return ['ok'];
  }
}
