// BI Brain rule evaluator (DL-058-063). A minimal custom evaluator rather
// than a rules-engine package (json-rules-engine or similar) — this repo has
// no comparable dependency anywhere, and the actual need (AND/OR/NOT over
// fact comparisons) is small enough that a package would add a dependency
// and its own DSL quirks for no real benefit over ~150 lines of typed TS.
// Structural precedent: src/utils/deterministicRulesEngine.ts's pure,
// UI-decoupled evaluator functions — not that file's versioning (it has
// none of its own; bi_rules' immutability comes from its insert-only RLS
// schema instead, see the migration).

export type BiRuleParameterType = 'number' | 'boolean' | 'string';

export interface BiRuleParameterDef {
  name: string;
  type: BiRuleParameterType;
  default: number | boolean | string;
  min?: number;
  max?: number;
}

// A condition's `value` may be a literal, or a reference to a tenant-tunable
// parameter (DL-059) — resolved against that tenant's current parameter_values
// (falling back to the rule's own declared default) at evaluation time.
export type BiRuleValueRef = { param: string } | string | number | boolean;

export type BiRuleComparisonOperator =
  | 'equal'
  | 'notEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'in'
  | 'notIn';

export interface BiRuleFactCondition {
  fact: string;
  operator: BiRuleComparisonOperator;
  value: BiRuleValueRef | BiRuleValueRef[];
}

export type BiRuleCondition =
  | { all: BiRuleCondition[] }
  | { any: BiRuleCondition[] }
  | { not: BiRuleCondition }
  | BiRuleFactCondition;

export type BiRuleEventType = 'REDIRECT_TO_APPROVAL' | 'INFORMATIONAL';

export interface BiRuleEvent {
  type: BiRuleEventType;
  params?: Record<string, unknown>;
}

export interface BiRuleDefinition {
  ruleId: string;
  version: number;
  category: string;
  description: string;
  conditions: BiRuleCondition;
  event: BiRuleEvent;
  parameters: BiRuleParameterDef[];
}

function isParamRef(value: unknown): value is { param: string } {
  return typeof value === 'object' && value !== null && 'param' in value;
}

function resolveValue(
  ref: BiRuleValueRef,
  parameterValues: Record<string, unknown>,
  parameters: BiRuleParameterDef[]
): unknown {
  if (!isParamRef(ref)) return ref;
  const def = parameters.find((p) => p.name === ref.param);
  if (!def) throw new Error(`Unknown parameter reference: ${ref.param}`);
  return parameterValues[ref.param] ?? def.default;
}

function evaluateFactCondition(
  condition: BiRuleFactCondition,
  facts: Record<string, unknown>,
  parameterValues: Record<string, unknown>,
  parameters: BiRuleParameterDef[]
): boolean {
  const factValue = facts[condition.fact];
  const resolveOne = (v: BiRuleValueRef) => resolveValue(v, parameterValues, parameters);

  switch (condition.operator) {
    case 'equal':
      return factValue === resolveOne(condition.value as BiRuleValueRef);
    case 'notEqual':
      return factValue !== resolveOne(condition.value as BiRuleValueRef);
    case 'lessThan':
      return (factValue as number) < (resolveOne(condition.value as BiRuleValueRef) as number);
    case 'lessThanOrEqual':
      return (factValue as number) <= (resolveOne(condition.value as BiRuleValueRef) as number);
    case 'greaterThan':
      return (factValue as number) > (resolveOne(condition.value as BiRuleValueRef) as number);
    case 'greaterThanOrEqual':
      return (factValue as number) >= (resolveOne(condition.value as BiRuleValueRef) as number);
    case 'in':
      return (condition.value as BiRuleValueRef[]).map(resolveOne).includes(factValue);
    case 'notIn':
      return !(condition.value as BiRuleValueRef[]).map(resolveOne).includes(factValue);
    default:
      throw new Error(`Unknown operator: ${(condition as BiRuleFactCondition).operator}`);
  }
}

export function evaluateRuleCondition(
  condition: BiRuleCondition,
  facts: Record<string, unknown>,
  parameterValues: Record<string, unknown>,
  parameters: BiRuleParameterDef[]
): boolean {
  if ('all' in condition) return condition.all.every((c) => evaluateRuleCondition(c, facts, parameterValues, parameters));
  if ('any' in condition) return condition.any.some((c) => evaluateRuleCondition(c, facts, parameterValues, parameters));
  if ('not' in condition) return !evaluateRuleCondition(condition.not, facts, parameterValues, parameters);
  return evaluateFactCondition(condition, facts, parameterValues, parameters);
}

export function evaluateRule(
  rule: BiRuleDefinition,
  facts: Record<string, unknown>,
  parameterValues: Record<string, unknown>
): boolean {
  return evaluateRuleCondition(rule.conditions, facts, parameterValues, rule.parameters);
}

export interface ParameterValidationResult {
  valid: boolean;
  reason?: string;
}

// DL-059: enforced both here (server-side, authoritative) and client-side in
// the BI Config page — a value out of the platform's declared bounds is
// rejected, never clamped, so the tenant sees exactly why their input didn't
// save.
export function validateParameterValue(def: BiRuleParameterDef, value: unknown): ParameterValidationResult {
  if (def.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) return { valid: false, reason: `${def.name} must be a number` };
    if (def.min !== undefined && value < def.min) return { valid: false, reason: `${def.name} must be >= ${def.min}` };
    if (def.max !== undefined && value > def.max) return { valid: false, reason: `${def.name} must be <= ${def.max}` };
    return { valid: true };
  }
  if (def.type === 'boolean') {
    return typeof value === 'boolean' ? { valid: true } : { valid: false, reason: `${def.name} must be a boolean` };
  }
  if (def.type === 'string') {
    return typeof value === 'string' ? { valid: true } : { valid: false, reason: `${def.name} must be a string` };
  }
  return { valid: false, reason: `Unknown parameter type for ${def.name}` };
}

// Fills in a rule's declared defaults for any parameter missing from a
// tenant's stored values — used both at evaluation time and by the
// migration-reconciliation step (a newer rule version's added parameter
// should apply immediately, not wait for the tenant to notice and save).
export function resolveParameterValues(
  parameters: BiRuleParameterDef[],
  stored: Record<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const def of parameters) {
    resolved[def.name] = stored[def.name] ?? def.default;
  }
  return resolved;
}
