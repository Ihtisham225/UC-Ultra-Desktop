/**
 * The lab module belongs to pharmacies. The `lab_tests_enabled` flag alone is
 * not enough to gate on: a shop that turns lab tests on and later switches its
 * store type away from pharmacy keeps the stale flag, and would otherwise go on
 * showing Lab, Results, Patients and the POS Lab tab forever. Always ask this
 * rather than reading the flag directly.
 */
export function isLabEnabled(
  shop?: { store_type?: string | null; lab_tests_enabled?: boolean | null } | null,
): boolean {
  return shop?.store_type === "pharmacy" && !!shop?.lab_tests_enabled;
}
