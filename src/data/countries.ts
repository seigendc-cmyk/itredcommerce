// Deliberately small (not a full ISO-3166 list) — the markets this product
// actually targets today, per the fiscalization work already built
// (ZIMRA/Zimbabwe live, KRA eTIMS/Kenya as a reference implementation only).
// "Other" covers everything else with manual entry; adding a real country
// here later is just adding a row, not a schema change (tenants.country is
// free-form ISO 3166-1 alpha-2 text).
export interface CountryOption {
  code: string;
  name: string;
  defaultCurrency: string;
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'ZW', name: 'Zimbabwe', defaultCurrency: 'USD' },
  { code: 'KE', name: 'Kenya', defaultCurrency: 'KES' },
  { code: 'ZM', name: 'Zambia', defaultCurrency: 'ZMW' },
  { code: 'MW', name: 'Malawi', defaultCurrency: 'MWK' },
  { code: 'MZ', name: 'Mozambique', defaultCurrency: 'MZN' },
  { code: 'ZA', name: 'South Africa', defaultCurrency: 'ZAR' },
  { code: 'BW', name: 'Botswana', defaultCurrency: 'BWP' },
];

export function countryName(code?: string | null): string {
  return COUNTRY_OPTIONS.find((c) => c.code === code)?.name ?? code ?? '—';
}

export function defaultCurrencyForCountry(code?: string | null): string | undefined {
  return COUNTRY_OPTIONS.find((c) => c.code === code)?.defaultCurrency;
}
