import { BusinessType } from '../types';

// Confirmed taxonomy (see ITRED_GOVERNANCE_AND_ARCHITECTURE.md's Business
// Profile Onboarding addendum) — tuned to the Zimbabwe/Kenya retail SME
// market this product targets, not a generic global industry list. May
// later feed BI Brain peer-group benchmarking (e.g. shrinkage-rate
// comparisons need tenants grouped with real peers, not "retail" writ
// large).
export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: 'GENERAL_RETAIL', label: 'General Retail / Supermarket' },
  { value: 'WHOLESALE_DISTRIBUTION', label: 'Wholesale & Distribution' },
  { value: 'HOSPITALITY', label: 'Hospitality (Restaurant / Bar / Takeaway)' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'HARDWARE_BUILDING', label: 'Hardware & Building Supplies' },
  { value: 'FASHION_APPAREL', label: 'Fashion & Apparel' },
  { value: 'ELECTRONICS_APPLIANCES', label: 'Electronics & Appliances' },
  { value: 'LIQUOR_BOTTLE_STORE', label: 'Liquor / Bottle Store' },
  { value: 'BUTCHERY_FRESH_PRODUCE', label: 'Butchery & Fresh Produce' },
  { value: 'AUTOMOTIVE_PARTS_SERVICES', label: 'Automotive Parts & Services' },
  { value: 'SALON_PERSONAL_CARE', label: 'Salon & Personal Care' },
  { value: 'OTHER', label: 'Other' },
];

export function businessTypeLabel(value?: BusinessType | string | null): string {
  return BUSINESS_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}
