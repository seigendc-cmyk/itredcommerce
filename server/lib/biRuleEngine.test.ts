import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRule,
  validateParameterValue,
  resolveParameterValues,
  type BiRuleDefinition,
  type BiRuleParameterDef,
} from './biRuleEngine';

const SALES_THRESHOLD_PARAM: BiRuleParameterDef = {
  name: 'sales_threshold',
  type: 'number',
  default: 0,
  min: 0,
  max: 1000,
};

const DEAD_STOCK_RULE: BiRuleDefinition = {
  ruleId: 'BI-DEADSTOCK-RESTOCK-001',
  version: 1,
  category: 'DEAD_STOCK_SEASONAL_DISPOSAL',
  description: 'Redirect to approval if a restock is requested with sales since last request at or below the threshold.',
  conditions: {
    all: [{ fact: 'salesSinceLastRequest', operator: 'lessThanOrEqual', value: { param: 'sales_threshold' } }],
  },
  event: { type: 'REDIRECT_TO_APPROVAL' },
  parameters: [SALES_THRESHOLD_PARAM],
};

test('fires when sales since last request is at the default threshold (0)', () => {
  assert.equal(evaluateRule(DEAD_STOCK_RULE, { salesSinceLastRequest: 0 }, {}), true);
});

test('does not fire when sales since last request exceeds the default threshold', () => {
  assert.equal(evaluateRule(DEAD_STOCK_RULE, { salesSinceLastRequest: 5 }, {}), false);
});

test('a tenant-tuned parameter value is used over the platform default', () => {
  assert.equal(evaluateRule(DEAD_STOCK_RULE, { salesSinceLastRequest: 3 }, { sales_threshold: 5 }), true);
  assert.equal(evaluateRule(DEAD_STOCK_RULE, { salesSinceLastRequest: 3 }, { sales_threshold: 2 }), false);
});

test('all/any/not composition evaluates correctly', () => {
  const rule: BiRuleDefinition = {
    ...DEAD_STOCK_RULE,
    conditions: {
      any: [
        { fact: 'a', operator: 'equal', value: 1 },
        { not: { fact: 'b', operator: 'equal', value: true } },
      ],
    },
  };
  assert.equal(evaluateRule(rule, { a: 1, b: true }, {}), true); // a matches
  assert.equal(evaluateRule(rule, { a: 2, b: false }, {}), true); // not(b) matches
  assert.equal(evaluateRule(rule, { a: 2, b: true }, {}), false); // neither matches
});

test('in / notIn operators resolve each list entry, including parameter refs', () => {
  const rule: BiRuleDefinition = {
    ...DEAD_STOCK_RULE,
    conditions: { fact: 'category', operator: 'in', value: ['A', { param: 'sales_threshold' }] },
    parameters: [{ ...SALES_THRESHOLD_PARAM, type: 'string', default: 'B' }],
  };
  assert.equal(evaluateRule(rule, { category: 'B' }, {}), true);
  assert.equal(evaluateRule(rule, { category: 'C' }, {}), false);
});

test('an unknown parameter reference throws rather than silently evaluating false', () => {
  const rule: BiRuleDefinition = {
    ...DEAD_STOCK_RULE,
    conditions: { fact: 'x', operator: 'equal', value: { param: 'does_not_exist' } },
  };
  assert.throws(() => evaluateRule(rule, { x: 1 }, {}));
});

test('validateParameterValue rejects out-of-bounds and wrong-typed values, accepts valid ones', () => {
  assert.equal(validateParameterValue(SALES_THRESHOLD_PARAM, 5).valid, true);
  assert.equal(validateParameterValue(SALES_THRESHOLD_PARAM, -1).valid, false);
  assert.equal(validateParameterValue(SALES_THRESHOLD_PARAM, 1001).valid, false);
  assert.equal(validateParameterValue(SALES_THRESHOLD_PARAM, 'five').valid, false);
  assert.equal(validateParameterValue({ name: 'enabled_flag', type: 'boolean', default: true }, 'yes').valid, false);
  assert.equal(validateParameterValue({ name: 'enabled_flag', type: 'boolean', default: true }, true).valid, true);
});

test('resolveParameterValues fills in defaults for missing parameters without touching stored ones', () => {
  const resolved = resolveParameterValues(
    [SALES_THRESHOLD_PARAM, { name: 'new_param', type: 'number', default: 42 }],
    { sales_threshold: 7 }
  );
  assert.deepEqual(resolved, { sales_threshold: 7, new_param: 42 });
});
