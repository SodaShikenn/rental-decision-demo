import { applyResearch, missingFields, researchInput, safeSourceUrl } from "./services.js";

const DAY = 86400000;
export const monthlyFingerprint = (property) => JSON.stringify(researchInput(property));
export const needsMonthlyResearch = (property) => missingFields(property).some((key) => ["rent", "managementFee"].includes(key));
export function researchDue(property, now = Date.now()) {
  if (!needsMonthlyResearch(property) || !property.name || !property.address || property.provenance?.mode === "mock") return false;
  const saved = property.monthlyResearch;
  if (saved?.fingerprint !== monthlyFingerprint(property)) return true;
  const elapsed = now - Date.parse(saved.attemptedAt);
  // A restored in-flight request can be retried; failed searches don't loop on every render.
  return !Number.isFinite(elapsed) || elapsed >= (saved.status === "searching" ? 180000 : DAY);
}
export function monthlyReferences(property) {
  const research = property.monthlyResearch;
  if (research?.fingerprint !== monthlyFingerprint(property)) return [];
  return (research.listings ?? []).flatMap((listing) => {
    if (!["same_building", "same_unit"].includes(listing.match) || listing.scope !== "unit") return [];
    const rent = listing.facts.find((fact) => fact.key === "rent");
    const fee = listing.facts.find((fact) => fact.key === "managementFee");
    if (!rent || !fee || typeof rent.value !== "number" || rent.value <= 0 || !Number.isFinite(rent.value) || typeof fee.value !== "number" || fee.value < 0 || !Number.isFinite(fee.value)) return [];
    // Never combine a price and fee from different pages, or an archive with a current offer.
    if (!safeSourceUrl(rent.source?.url) || rent.source.url !== fee.source?.url || [rent, fee].some((fact) => fact.source.status !== "current" || fact.source.url.includes("/library/"))) return [];
    return [{ ...listing, rent: rent.value, managementFee: fee.value, monthly: rent.value + fee.value, source: rent.source,
      layout: listing.facts.find((fact) => fact.key === "layout")?.value,
      areaSqm: listing.facts.find((fact) => fact.key === "areaSqm")?.value }];
  });
}

/** Automatic updates require a cited exact unit and agreement across returned offers. */
export function supplementMonthly(property, response, attemptedAt = new Date().toISOString()) {
  let updated = property;
  const listings = response.listings ?? [];
  const units = listings.filter((listing) => listing.match === "same_unit" && listing.scope === "unit" && listing.identityVerified);
  const candidates = units.filter((listing) => !listing.facts.some((fact) =>
    ["rent", "managementFee", "layout", "areaSqm"].includes(fact.key) &&
    property[fact.key] != null && !(property.unconfirmedFields ?? []).includes(fact.key) && property[fact.key] !== fact.value));
  // A conflicting same-unit offer requires review, even when another offer agrees.
  const conflicts = ["rent", "managementFee"].some((key) => new Set(units.flatMap((listing) => listing.facts.filter((fact) => fact.key === key).map((fact) => fact.value))).size > 1);
  if (!conflicts && candidates.length === units.length) {
    const facts = candidates.flatMap((listing) => listing.facts).filter((fact) =>
      ["rent", "managementFee"].includes(fact.key) && fact.eligible && fact.source?.status === "current");
    updated = applyResearch(property, facts);
  }
  return { ...updated, monthlyResearch: { ...response, fingerprint: monthlyFingerprint(updated), attemptedAt, status: "complete" } };
}
