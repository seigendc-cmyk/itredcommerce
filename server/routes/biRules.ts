import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { validateParameterValue, resolveParameterValues, type BiRuleParameterDef } from '../lib/biRuleEngine';

// BI Config page's backend (DL-059): lists the platform rule catalog
// merged with this tenant's local settings (defaulting to enabled=true +
// platform defaults for a rule never explicitly configured), and lets a
// head-office session adjust enabled/parameter_values within
// platform-declared bounds. Head-office-only, per DL-059/point 4 — the
// same BACK_OFFICE_WRITE_ROLES gate purchasing/billing routes already use.

const router = Router();
router.use(requireAuth);

interface BiRuleCacheRow {
  rule_id: string;
  version: number;
  category: string;
  description: string;
  conditions: string;
  event: string;
  parameters: string;
}

interface TenantBiRuleSettingsRow {
  rule_version: number;
  enabled: number;
  parameter_values: string;
  orphaned_parameters: string;
}

router.get(
  '/',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (_req, res) => {
    const ruleRows = db
      .prepare(
        `SELECT rule_id, MAX(version) AS version, category, description, conditions, event, parameters
         FROM bi_rules_cache GROUP BY rule_id ORDER BY category, rule_id`
      )
      .all() as unknown as BiRuleCacheRow[];

    const rules = ruleRows.map((rule) => {
      const parameters = JSON.parse(rule.parameters) as BiRuleParameterDef[];
      const settingsRow = db
        .prepare(`SELECT rule_version, enabled, parameter_values, orphaned_parameters FROM tenant_bi_rule_settings WHERE rule_id = ?`)
        .get(rule.rule_id) as unknown as TenantBiRuleSettingsRow | undefined;

      const storedValues = settingsRow ? JSON.parse(settingsRow.parameter_values) : {};

      return {
        ruleId: rule.rule_id,
        version: rule.version,
        category: rule.category,
        description: rule.description,
        parameters,
        enabled: settingsRow ? !!settingsRow.enabled : true,
        parameterValues: resolveParameterValues(parameters, storedValues),
        orphanedParameters: settingsRow ? (JSON.parse(settingsRow.orphaned_parameters) as string[]) : [],
      };
    });

    res.json(rules);
  })
);

interface SettingsPatchBody {
  enabled?: boolean;
  parameterValues?: Record<string, unknown>;
  acknowledgeOrphanedParameters?: boolean;
}

router.patch(
  '/:ruleId/settings',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const ruleId = req.params.ruleId;
    const ruleRow = db
      .prepare(`SELECT rule_id, MAX(version) AS version, parameters FROM bi_rules_cache WHERE rule_id = ? GROUP BY rule_id`)
      .get(ruleId) as { version: number; parameters: string } | undefined;
    if (!ruleRow) throw new ApiError(404, 'Rule not found');

    const parameters = JSON.parse(ruleRow.parameters) as BiRuleParameterDef[];
    const body = req.body as SettingsPatchBody;

    const existing = db
      .prepare(`SELECT rule_version, enabled, parameter_values, orphaned_parameters FROM tenant_bi_rule_settings WHERE rule_id = ?`)
      .get(ruleId) as unknown as TenantBiRuleSettingsRow | undefined;

    const currentValues = existing ? JSON.parse(existing.parameter_values) : {};
    const nextValues = { ...resolveParameterValues(parameters, currentValues), ...(body.parameterValues ?? {}) };

    for (const def of parameters) {
      if (!(def.name in nextValues)) continue;
      const result = validateParameterValue(def, nextValues[def.name]);
      if (!result.valid) throw new ApiError(400, result.reason ?? `Invalid value for ${def.name}`, 'INVALID_PARAMETER_VALUE');
    }

    const orphanedParameters = body.acknowledgeOrphanedParameters
      ? []
      : existing
        ? (JSON.parse(existing.orphaned_parameters) as string[])
        : [];

    db.prepare(
      `INSERT INTO tenant_bi_rule_settings (rule_id, rule_version, enabled, parameter_values, orphaned_parameters, dirty)
       VALUES (@ruleId, @ruleVersion, @enabled, @parameterValues, @orphanedParameters, 1)
       ON CONFLICT(rule_id) DO UPDATE SET
         rule_version = excluded.rule_version, enabled = excluded.enabled,
         parameter_values = excluded.parameter_values, orphaned_parameters = excluded.orphaned_parameters,
         dirty = 1`
    ).run({
      ruleId,
      ruleVersion: ruleRow.version,
      enabled: (body.enabled ?? (existing ? !!existing.enabled : true)) ? 1 : 0,
      parameterValues: JSON.stringify(nextValues),
      orphanedParameters: JSON.stringify(orphanedParameters),
    });

    res.json({
      ruleId,
      version: ruleRow.version,
      enabled: body.enabled ?? (existing ? !!existing.enabled : true),
      parameterValues: nextValues,
      orphanedParameters,
    });
  })
);

export default router;
