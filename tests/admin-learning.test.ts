import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  learningRecordingGroup,
  learningSessionGroup,
} from '../src/lib/admin/learning';

const now = new Date('2026-11-17T13:45:00.000Z');

test('Class groups include the full current UTC day regardless of local time or whether a class has ended', () => {
  for (const [starts, ends] of [
    ['2026-11-17T00:00:00.000Z', '2026-11-17T01:00:00.000Z'],
    ['2026-11-17T12:00:00.000Z', '2026-11-17T13:00:00.000Z'],
    ['2026-11-17T18:00:00.000Z', '2026-11-17T19:00:00.000Z'],
    ['2026-11-17T23:59:59.999Z', '2026-11-18T01:00:00.000Z'],
    ['2026-11-18T01:30:00.000+05:30', '2026-11-18T02:30:00.000+05:30'],
  ]) {
    assert.equal(learningSessionGroup({ starts, ends }, now), 'Today');
  }
});

test('Classes crossing UTC midnight remain Today while they overlap the day', () => {
  for (const [starts, ends] of [
    ['2026-11-16T23:00:00.000Z', '2026-11-17T01:00:00.000Z'],
    ['2026-11-16T23:00:00.000Z', '2026-11-17T14:00:00.000Z'],
    ['2026-11-16T23:00:00.000Z', '2026-11-18T01:00:00.000Z'],
  ]) {
    assert.equal(learningSessionGroup({ starts, ends }, now), 'Today');
  }
});

test('Upcoming starts at the next UTC midnight and excludes the current day', () => {
  for (const [starts, ends] of [
    ['2026-11-18T00:00:00.000Z', '2026-11-18T01:00:00.000Z'],
    ['2026-11-20T20:00:00.000Z', '2026-11-20T21:00:00.000Z'],
  ]) {
    assert.equal(learningSessionGroup({ starts, ends }, now), 'Upcoming');
  }
});

test('Past includes classes ending exactly at the current UTC midnight', () => {
  for (const [starts, ends] of [
    ['2026-11-16T22:00:00.000Z', '2026-11-17T00:00:00.000Z'],
    ['2026-11-16T20:00:00.000Z', '2026-11-16T21:00:00.000Z'],
    ['2026-11-17T01:00:00.000+05:30', '2026-11-17T02:00:00.000+05:30'],
  ]) {
    assert.equal(learningSessionGroup({ starts, ends }, now), 'Past');
  }
});

test('Today follows the UTC date of now even when the device offset is ahead', () => {
  assert.equal(
    learningSessionGroup(
      {
        starts: '2026-11-17T00:00:00.000Z',
        ends: '2026-11-17T01:00:00.000Z',
      },
      new Date('2026-11-17T02:00:00.000+05:30'),
    ),
    'Upcoming',
  );
});

test('Recording groups distinguish ready and published existing recordings', () => {
  assert.equal(
    learningRecordingGroup({ status: 'READY', cleanupPending: false }),
    'Needs Publishing',
  );
  assert.equal(
    learningRecordingGroup({ status: 'PUBLISHED', cleanupPending: false }),
    'Published',
  );
});

test('Missing, uploading, processing, failed and unknown recordings stay unavailable', () => {
  assert.equal(learningRecordingGroup(null), 'Processing / Unavailable');
  for (const status of ['UPLOADING', 'PROCESSING', 'FAILED', 'UNKNOWN']) {
    assert.equal(
      learningRecordingGroup({ status, cleanupPending: false }),
      'Processing / Unavailable',
    );
  }
});

test('Pending cleanup takes precedence over every recording lifecycle status', () => {
  for (const status of [
    'UPLOADING',
    'PROCESSING',
    'READY',
    'PUBLISHED',
    'FAILED',
  ]) {
    assert.equal(
      learningRecordingGroup({ status, cleanupPending: true }),
      'Processing / Unavailable',
    );
  }
});

test('Current Admin UI sample Student IDs use the current ST format', () => {
  const fixture = readFileSync('tests/helpers/admin-ui/data.ts', 'utf8');
  const samples = [...fixture.matchAll(/studentId: '([^']+)'/g)].map(
    (match) => match[1],
  );
  assert.ok(samples.length > 0);
  for (const id of samples) assert.match(id, /^ST-\d{4}-\d{6}$/);
  assert.equal(fixture.includes(['MLM', 'STU', ''].join('-')), false);
});
