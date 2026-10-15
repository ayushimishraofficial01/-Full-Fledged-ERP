import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInvoiceTotals, validateInvoice } from './billing.js';

const sample = {
  customer: 'SAMPAT TRADING CO.', credits: '91269',
  lines: [
    { description: 'Compostable Milky Carry bags 9*12', qty: '1000', rate: '160', gst: '5' },
    { description: 'Compostable Milky Carry bags 11*14', qty: '100', rate: '160', gst: '5' },
    { description: 'Compostable Milky Carry bags 17*23', qty: '125', rate: '160', gst: '5' },
  ],
};

test('calculates the sample invoice subtotal, GST, total, and balance', () => {
  assert.deepEqual(calculateInvoiceTotals(sample), {
    subtotal: 196000,
    tax: 9800,
    gross: 205800,
    total: 114531,
  });
});

test('validates a complete invoice', () => {
  assert.equal(validateInvoice(sample), null);
});

test('requires a customer and at least one complete line', () => {
  assert.equal(validateInvoice({ ...sample, customer: '' }), 'Add a customer name before saving.');
  assert.equal(validateInvoice({ ...sample, lines: [] }), 'Add at least one item to the invoice.');
  assert.match(validateInvoice({ ...sample, lines: [{ ...sample.lines[0], qty: '0' }] }), /quantity above zero/);
  assert.match(validateInvoice({ ...sample, lines: [{ ...sample.lines[0], rate: '' }] }), /valid rate/);
});

test('rounds fractional GST and never makes the balance negative', () => {
  assert.deepEqual(calculateInvoiceTotals({ credits: 100, lines: [{ qty: 1, rate: 0.1, gst: 5 }] }), {
    subtotal: 0.1,
    tax: 0.01,
    gross: 0.11,
    total: 0,
  });
  assert.equal(validateInvoice({ ...sample, credits: '-1' }), 'Credits applied cannot be negative.');
});
