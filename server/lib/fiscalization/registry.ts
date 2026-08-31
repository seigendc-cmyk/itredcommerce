import type { FiscalizationProvider, FiscalizationProviderDescriptor } from './types';
import { zimraVirtualProvider } from './providers/zimraVirtualProvider';
import { kraETimsReferenceProvider } from './providers/kraETimsReferenceProvider';

// One place every provider is registered — country -> providers offered in
// Settings (Prompt 11 requirement 7: tenant.country determines what's
// offered). Kenya is listed as a reference implementation only (see that
// provider file's header comment); Zambia/Malawi/Mozambique are
// deliberately absent until a later prompt builds them — adding one means
// adding it here and nowhere else (no call site or Settings UI structure
// change required).
const ALL_PROVIDERS: FiscalizationProvider[] = [zimraVirtualProvider, kraETimsReferenceProvider];

export function providersForCountry(countryCode: string): FiscalizationProviderDescriptor[] {
  return ALL_PROVIDERS.filter((p) => p.descriptor.countryCode === countryCode.toUpperCase()).map((p) => p.descriptor);
}

export function getProvider(providerKey: string): FiscalizationProvider | undefined {
  return ALL_PROVIDERS.find((p) => p.descriptor.providerKey === providerKey);
}
