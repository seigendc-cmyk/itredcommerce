// Delivery fare calculation engine (Prompt 8). Pure, deterministic function
// over a specific rate_config version — mirrors the versioning discipline
// src/utils/deterministicRulesEngine.ts already uses (a versioned
// definition applied at calculation time, with the version that produced a
// result recorded onto that result). Never reads "the current" rate
// implicitly from inside here — callers pass in the exact rate_config row
// they've already selected, so which version produced a fare is always
// explicit at the call site (server/routes/deliveryOrders.ts).
//
// FORMULA (confirmed structure -- see ITRED_GOVERNANCE_AND_ARCHITECTURE.md;
// actual rate numbers are vendor-entered via Settings, never hardcoded here):
//   fare = base_fee
//        + (distance_km * per_km_rate)
//        + load_surcharge[load_tier] * ride_type_multiplier[ride_type]

export type DeliveryLoadSizeTier = 'small' | 'medium' | 'large';
export type DeliveryRideType = 'bicycle' | 'motorbike' | 'car' | 'van';
export type DeliveryRouteClass = 'local' | 'intercity';

export interface FareRateConfig {
  version: number;
  currency: string;
  baseFee: number;
  perKmRate: number;
  useSeparateIntercityRate: boolean;
  perKmRateIntercity: number | null;
  loadSizeSurcharges: Partial<Record<DeliveryLoadSizeTier, number>>;
  rideTypeMultipliers: Partial<Record<DeliveryRideType, number>>;
  isMultiCurrency: boolean;
  settlementCurrency: string | null;
  exchangeRateToSettlement: number | null;
}

export interface FareCalculationInput {
  distanceKm: number;
  routeClass: DeliveryRouteClass;
  loadSizeTier: DeliveryLoadSizeTier;
  rideTypeRequirement: DeliveryRideType;
}

export interface FareCalculationResult {
  fareAmount: number;
  fareCurrency: string;
  rateConfigVersion: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateFare(rateConfig: FareRateConfig, input: FareCalculationInput): FareCalculationResult {
  const perKmRate =
    rateConfig.useSeparateIntercityRate && input.routeClass === 'intercity' && rateConfig.perKmRateIntercity != null
      ? rateConfig.perKmRateIntercity
      : rateConfig.perKmRate;

  const loadSurcharge = rateConfig.loadSizeSurcharges[input.loadSizeTier] ?? 0;
  const rideMultiplier = rateConfig.rideTypeMultipliers[input.rideTypeRequirement] ?? 1;

  const fareInRateCurrency = rateConfig.baseFee + input.distanceKm * perKmRate + loadSurcharge * rideMultiplier;

  const applyConversion = rateConfig.isMultiCurrency && !!rateConfig.settlementCurrency && !!rateConfig.exchangeRateToSettlement;

  return {
    fareAmount: round2(applyConversion ? fareInRateCurrency * rateConfig.exchangeRateToSettlement! : fareInRateCurrency),
    fareCurrency: applyConversion ? rateConfig.settlementCurrency! : rateConfig.currency,
    rateConfigVersion: rateConfig.version,
  };
}
