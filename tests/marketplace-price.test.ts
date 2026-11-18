import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currencyFractionDigits,
  marketplacePriceInput,
  marketplacePriceMinorMax,
  parseMarketplacePrice,
} from '../src/lib/marketplace/price';
import { marketplacePrice } from '../src/components/admin/marketplace/format';

test('human INR prices convert to exact integer paise without floating-point multiplication', () => {
  for (const [input, expected] of [
    ['15000', 1500000],
    ['15000.00', 1500000],
    ['15000.50', 1500050],
    ['0.29', 29],
    ['0.01', 1],
    ['00015000.50', 1500050],
    [' 15000.50 ', 1500050],
  ] as const)
    assert.equal(parseMarketplacePrice(input, 'INR'), expected);
});

test('zero is a real price and blank or null remains unannounced', () => {
  for (const value of ['0', '0.00', '000.00'])
    assert.equal(parseMarketplacePrice(value, 'INR'), 0);
  for (const value of ['', '   ', null])
    assert.equal(parseMarketplacePrice(value, 'INR'), null);
  assert.equal(marketplacePrice(0, 'INR'), '₹0');
  assert.equal(marketplacePrice(null, 'INR'), 'To be announced');
  assert.equal(marketplacePrice(1500000, 'INR'), '₹15,000');
  assert.equal(marketplacePrice(1500050, 'INR'), '₹15,000.50');
});

test('negative, malformed, localized, exponent and nonfinite input is rejected', () => {
  for (const value of [
    '-1',
    '+1',
    '1e3',
    'Infinity',
    'NaN',
    '.50',
    '15.',
    '1.2.3',
    '15,000',
    '₹15000',
    '1 000',
    '1\n2',
    '０.５０',
  ]) {
    assert.throws(
      () => parseMarketplacePrice(value, 'INR'),
      /nonnegative price/,
    );
  }
});

test('currency precision comes from Intl, including zero-decimal JPY and three-decimal KWD', () => {
  assert.equal(currencyFractionDigits('INR'), 2);
  assert.equal(currencyFractionDigits('JPY'), 0);
  assert.equal(currencyFractionDigits('KWD'), 3);
  assert.equal(parseMarketplacePrice('15000', 'JPY'), 15000);
  assert.equal(parseMarketplacePrice('15000.501', 'KWD'), 15000501);
  assert.equal(parseMarketplacePrice('0.001', 'KWD'), 1);
  assert.throws(() => parseMarketplacePrice('1.00', 'JPY'), /whole-number/);
  assert.throws(
    () => parseMarketplacePrice('1.001', 'INR'),
    /2 decimal places/,
  );
  assert.throws(
    () => parseMarketplacePrice('1.0001', 'KWD'),
    /3 decimal places/,
  );
});

test('the PostgreSQL integer boundary is enforced exactly for each supported precision', () => {
  for (const [currency, maximum, overflow] of [
    ['INR', '21474836.47', '21474836.48'],
    ['JPY', '2147483647', '2147483648'],
    ['KWD', '2147483.647', '2147483.648'],
  ]) {
    assert.equal(
      parseMarketplacePrice(maximum, currency),
      marketplacePriceMinorMax,
    );
    assert.throws(
      () => parseMarketplacePrice(overflow, currency),
      /supported maximum/,
    );
    assert.throws(
      () => parseMarketplacePrice('9'.repeat(1000), currency),
      /supported maximum/,
    );
  }
});

test('stored integer prices round-trip through editable decimal strings without losing precision', () => {
  for (const currency of ['INR', 'JPY', 'KWD']) {
    for (const value of [0, 1, 29, 100, 1500050, marketplacePriceMinorMax]) {
      const input = marketplacePriceInput(value, currency);
      assert.equal(parseMarketplacePrice(input, currency), value);
    }
    assert.equal(marketplacePriceInput(null, currency), '');
  }
  assert.equal(marketplacePriceInput(1500000, 'INR'), '15000');
  assert.equal(marketplacePriceInput(1500050, 'INR'), '15000.5');
  assert.equal(marketplacePriceInput(1, 'KWD'), '0.001');
  for (const value of [
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    marketplacePriceMinorMax + 1,
  ]) {
    assert.throws(() => marketplacePriceInput(value, 'INR'), /stored price/);
  }
});

test('invalid currency syntax is rejected without narrowing the existing uppercase-code API contract', () => {
  for (const currency of ['', 'inr', 'ABCD', '123']) {
    assert.throws(
      () => parseMarketplacePrice('15000', currency),
      /three-letter uppercase currency/,
    );
    assert.throws(
      () => marketplacePriceInput(1500000, currency),
      /three-letter uppercase currency/,
    );
  }
  const precision =
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'ZZZ',
    }).resolvedOptions().maximumFractionDigits ?? 2;
  assert.equal(currencyFractionDigits('ZZZ'), precision);
  assert.equal(marketplacePriceInput(null, 'ZZZ'), '');
  assert.equal(marketplacePriceInput(1500000, 'ZZZ'), '15000');
});
