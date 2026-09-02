// Per-field validation for the Business Profile wizard/settings page.
// TIN format is validated per-country where a real format is known
// (Zimbabwe/Kenya, the two markets with real fiscalization providers
// already built); everything else falls back to a permissive non-empty
// check rather than guessing at a format this codebase has no source for —
// same discipline as the fiscalization work's "flag as placeholder rather
// than fabricate confidence" precedent.
const TIN_PATTERNS: Record<string, { pattern: RegExp; hint: string }> = {
  ZW: { pattern: /^\d{9,10}$/, hint: 'ZIMRA TIN is typically 9-10 digits' },
  KE: { pattern: /^[A-Z]\d{9}[A-Z]$/, hint: 'KRA PIN format: one letter, 9 digits, one letter (e.g. P051234567X)' },
};

export function validateTin(country: string, tin: string): string | undefined {
  if (!tin.trim()) return undefined; // optional field
  const rule = TIN_PATTERNS[country];
  if (rule && !rule.pattern.test(tin.trim().toUpperCase())) return rule.hint;
  return undefined;
}

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : 'Enter a valid email address';
}

export function validatePhone(phone: string): string | undefined {
  if (!phone.trim()) return undefined;
  return /^\+?[\d\s()-]{7,20}$/.test(phone.trim()) ? undefined : 'Enter a valid phone number';
}

export function validateHexColor(color: string): string | undefined {
  if (!color.trim()) return undefined;
  return /^#[0-9A-Fa-f]{6}$/.test(color.trim()) ? undefined : 'Use a hex color, e.g. #FF6B00';
}

export function validateLatLng(lat: number | undefined, lng: number | undefined): string | undefined {
  if (lat === undefined || lng === undefined || Number.isNaN(lat) || Number.isNaN(lng)) {
    return 'Branch coordinates are required — use "Locate Me" or enter them manually';
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return 'Coordinates are out of range';
  return undefined;
}
