import { PROFILES, SERVICES } from "./profiles";
import type {
  Availability,
  BasketLine,
  CheckoutInput,
  MilestoneState,
  OrderEvent,
  OrderView,
  PricedLine,
  ProfileDefinition,
  ProfileId,
  ScenarioId,
  ServiceHealth,
  StoredOrder,
  Totals,
} from "./types";

/** Time between milestones for a healthy order. */
export const STAGE_INTERVAL_MS = 4000;
/** Delay between an operator retry and the stalled milestone completing. */
export const RECOVERY_DELAY_MS = 1500;
export const STAGE_COUNT = 6;
export const PROMO_CODES: Record<string, number> = { WELCOME10: 0.1 };

/** Small deterministic hash (FNV-1a) so derived values are stable per input. */
export function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- pricing

export function priceLine(profile: ProfileDefinition, line: BasketLine): PricedLine | null {
  const product = profile.products.find((p) => p.slug === line.slug);
  const variant = product?.variants.find((v) => v.id === line.variantId);
  if (!product || !variant) return null;
  const addOns = profile.addOns.filter((a) => line.addOnIds.includes(a.id));
  const qty = Math.max(1, Math.min(10, Math.floor(line.qty) || 1));
  const unitPrice = variant.price + addOns.reduce((s, a) => s + a.price, 0);
  return {
    slug: line.slug,
    variantId: variant.id,
    addOnIds: addOns.map((a) => a.id),
    qty,
    name: product.name,
    variantLabel: variant.label,
    addOnNames: addOns.map((a) => a.name),
    unitPrice,
    lineTotal: round2(unitPrice * qty),
  };
}

export function priceBasket(profile: ProfileDefinition, lines: BasketLine[], promoCode?: string) {
  const priced = lines.map((l) => priceLine(profile, l)).filter((l): l is PricedLine => l !== null);
  const subtotal = round2(priced.reduce((s, l) => s + l.lineTotal, 0));
  const code = promoCode?.trim().toUpperCase();
  const rate = code ? PROMO_CODES[code] ?? 0 : 0;
  const discount = round2(subtotal * rate);
  const tax = round2((subtotal - discount) * profile.taxRate);
  const totals: Totals = { subtotal, discount, tax, total: round2(subtotal - discount + tax) };
  return { lines: priced, totals, promoApplied: rate > 0 ? code : undefined };
}

// ----------------------------------------------------------- availability

export function normalizePostcode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

export function isValidPostcode(raw: string): boolean {
  return /^[A-Z0-9][A-Z0-9 -]{2,9}$/.test(normalizePostcode(raw));
}

/** Postcodes starting with "000" are deliberately outside the coverage area. */
export function checkAvailability(profileId: ProfileId, rawPostcode: string, now = Date.now()): Availability {
  const profile = PROFILES[profileId];
  const postcode = normalizePostcode(rawPostcode);
  const h = hash(postcode);
  const hub = profile.availability.hubs[h % profile.availability.hubs.length];
  const distanceKm = round2(0.4 + (h % 900) / 100);
  const available = !postcode.startsWith("000");
  if (profileId === "telecom") {
    return {
      available,
      postcode,
      hub,
      distanceKm,
      status: available ? "Full-fiber available" : "Not yet in coverage",
      detail: available
        ? `${12 + (h % 36)} free splitter ports at ${hub.name}, FTTH up to 2 Gbps`
        : "Your area is in our build plan. Register interest and we'll notify you.",
      eta: available ? `Installation from ${1 + (h % 3)} business day(s)` : "Coverage expected next quarter",
      checkedAt: now,
    };
  }
  return {
    available,
    postcode,
    hub,
    distanceKm,
    status: available ? "In stock for fast delivery" : "Delivery unavailable",
    detail: available
      ? `${40 + (h % 260)} units on hand at ${hub.name}`
      : "We don't deliver to this postcode yet.",
    eta: available ? (h % 2 === 0 ? "Arrives tomorrow with Next-Day Express" : "Arrives in 2 days") : "—",
    checkedAt: now,
  };
}

// -------------------------------------------------------------- checkout

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateCheckout(profile: ProfileDefinition, input: CheckoutInput): ValidationResult {
  const errors: Record<string, string> = {};
  const req = (key: string, value: string | undefined, label: string, min = 2) => {
    if (!value || value.trim().length < min) errors[key] = `${label} is required`;
  };
  if (!Array.isArray(input.items) || input.items.length === 0) errors.items = "Your basket is empty";
  else if (input.items.some((l) => !priceLine(profile, l))) errors.items = "Basket contains items that are not part of this store";
  req("fullName", input.customer?.fullName, "Full name");
  if (!EMAIL_RE.test(input.customer?.email ?? "")) errors.email = "Enter a valid email address";
  if (!/^[+\d][\d\s().-]{6,19}$/.test(input.customer?.phone ?? "")) errors.phone = "Enter a valid phone number";
  req("line1", input.address?.line1, "Address line 1", 3);
  req("city", input.address?.city, "City");
  if (!isValidPostcode(input.address?.postcode ?? "")) errors.postcode = "Enter a valid postcode / PIN";
  else if (!checkAvailability(profile.id, input.address.postcode).available)
    errors.postcode = profile.id === "telecom" ? "Fiber is not yet available at this postcode" : "We don't deliver to this postcode yet";
  if (!profile.journey.slotOptions.some((o) => o.value === input.journey?.slot)) errors.slot = `Choose a ${profile.journey.slotLabel.toLowerCase()}`;
  if (!profile.journey.preferenceOptions.some((o) => o.value === input.journey?.preference))
    errors.preference = `Choose a ${profile.journey.preferenceLabel.toLowerCase()}`;
  req("cardName", input.payment?.cardName, "Name on card");
  if (!/^\d{4}$/.test(input.payment?.last4 ?? "")) errors.cardNumber = "Enter the demo card number";
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(input.payment?.expiry ?? "")) errors.expiry = "Use MM/YY";
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Demo checkout only accepts well-known public test card numbers. */
export const TEST_CARDS: Record<string, string> = {
  "4242424242424242": "Visa",
  "4000056655665556": "Visa Debit",
  "5555555555554444": "Mastercard",
  "378282246310005": "Amex",
};

export function luhn(num: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return num.length > 11 && sum % 10 === 0;
}

// ---------------------------------------------------- order state machine

export function pickStall(order: Pick<StoredOrder, "id" | "profile">) {
  const reasons = PROFILES[order.profile].stallReasons;
  return reasons[hash(order.id) % reasons.length];
}

/**
 * Returns the completion timestamp of each milestone (null if it never completes),
 * plus the time at which a stall becomes visible.
 * Progression is derived purely from stored timestamps, so no background job is needed.
 */
export function schedule(order: StoredOrder): { times: (number | null)[]; stallAt?: number } {
  const t0 = order.createdAt;
  const times: (number | null)[] = [];
  const stall = order.stall;
  const stallAt = stall ? t0 + stall.stageIndex * STAGE_INTERVAL_MS : undefined;
  // A retry can never take effect before the stall itself happened.
  const resumeAt = order.recoveredAt !== undefined && stallAt !== undefined ? Math.max(order.recoveredAt, stallAt) : undefined;
  for (let i = 0; i < STAGE_COUNT; i++) {
    if (!stall || i < stall.stageIndex) {
      times.push(t0 + i * STAGE_INTERVAL_MS);
    } else if (resumeAt !== undefined) {
      times.push(resumeAt + RECOVERY_DELAY_MS + (i - stall.stageIndex) * STAGE_INTERVAL_MS);
    } else {
      times.push(null);
    }
  }
  return { times, stallAt };
}

export function materialize(order: StoredOrder, now: number = Date.now()): OrderView {
  const profile = PROFILES[order.profile];
  const { times, stallAt } = schedule(order);
  const done = times.map((t) => t !== null && t <= now);
  const completedStages = done.filter(Boolean).length;
  const stallVisible = !!order.stall && stallAt !== undefined && stallAt <= now;
  const stallActive = stallVisible && order.recoveredAt === undefined;

  const events: OrderEvent[] = [];
  const latency = (i: number, salt: string) => 35 + (hash(`${order.id}:${i}:${salt}`) % 180);
  profile.milestones.forEach((m, i) => {
    if (order.stall && i === order.stall.stageIndex && stallVisible) {
      events.push({
        id: `${order.id}-E${i + 1}F`,
        stageIndex: i,
        milestone: m.label,
        at: stallAt!,
        service: m.service,
        latencyMs: 4800 + (hash(order.id) % 900),
        technicalStatus: "200 OK",
        businessOutcome: "Blocked",
        detail: `${order.stall.code}: ${order.stall.reason}`,
      });
      if (order.recoveredAt !== undefined && order.recoveredAt <= now) {
        events.push({
          id: `${order.id}-E${i + 1}R`,
          stageIndex: i,
          milestone: m.label,
          at: order.recoveredAt,
          service: "order-orchestrator",
          latencyMs: latency(i, "retry"),
          technicalStatus: "202 Accepted",
          businessOutcome: "Retry requested",
          detail: "Operator retry: fault cleared, resuming orchestration",
        });
      }
    }
    if (done[i]) {
      const recovered = order.stall && i === order.stall.stageIndex;
      events.push({
        id: `${order.id}-E${i + 1}`,
        stageIndex: i,
        milestone: m.label,
        at: times[i]!,
        service: m.service,
        latencyMs: latency(i, "ok"),
        technicalStatus: i === 0 ? "201 Created" : "200 OK",
        businessOutcome: recovered ? "Recovered" : "Completed",
      });
    }
  });
  events.sort((a, b) => a.at - b.at);

  const milestones: MilestoneState[] = profile.milestones.map((m, i) => {
    let state: MilestoneState["state"] = "pending";
    if (done[i]) state = "done";
    else if (stallActive && i === order.stall!.stageIndex) state = "failed";
    else if (i === completedStages) state = "current";
    return { key: m.key, label: m.label, description: m.description, service: m.service, state, at: done[i] ? times[i]! : state === "failed" ? stallAt : undefined };
  });

  const status = completedStages === STAGE_COUNT ? "completed" : stallActive ? "stalled" : "in_progress";
  const current =
    status === "completed"
      ? profile.milestones[STAGE_COUNT - 1].label
      : status === "stalled"
        ? profile.milestones[order.stall!.stageIndex].label
        : profile.milestones[Math.min(completedStages, STAGE_COUNT - 1)].label;
  const { stall, recoveredAt, ...rest } = order;
  return {
    ...rest,
    status,
    completedStages,
    currentMilestone: current,
    milestones,
    events,
    stall: stall && stallVisible ? { ...stall, at: stallAt!, active: stallActive } : undefined,
    recoveredAt,
    updatedAt: events.length ? events[events.length - 1].at : order.createdAt,
  };
}

export function buildOrder(
  id: string,
  workspace: string,
  profileId: ProfileId,
  scenario: ScenarioId,
  input: CheckoutInput,
  now = Date.now(),
): StoredOrder {
  const profile = PROFILES[profileId];
  const { lines, totals, promoApplied } = priceBasket(profile, input.items, input.promoCode);
  const order: StoredOrder = {
    id,
    workspace,
    profile: profileId,
    scenario,
    createdAt: now,
    customer: { fullName: input.customer.fullName.trim(), email: input.customer.email.trim(), phone: input.customer.phone.trim() },
    address: { ...input.address, postcode: normalizePostcode(input.address.postcode) },
    journey: input.journey,
    payment: { last4: input.payment.last4, brand: input.payment.brand || "Card" },
    lines,
    promoCode: promoApplied,
    totals,
  };
  if (scenario === "stalled_order") order.stall = pickStall(order);
  return order;
}

/** Clears an active stall; remaining milestones complete from now. */
export function recoverOrder(order: StoredOrder, now = Date.now()): StoredOrder {
  return { ...order, recoveredAt: now };
}

export function newOrderId(existing: Set<string>, now = Date.now()): string {
  const year = new Date(now).getUTCFullYear();
  for (;;) {
    const id = `NX-${year}-${1000 + Math.floor(Math.random() * 9000)}`;
    if (!existing.has(id)) return id;
  }
}

// ------------------------------------------------------------ demo seeds

const SEED_CUSTOMERS = [
  { fullName: "Maya Patel", email: "maya.patel@example.com", phone: "+1 415 555 0101", city: "San Francisco", postcode: "94107" },
  { fullName: "Daniel Okafor", email: "d.okafor@example.com", phone: "+44 20 7946 0958", city: "London", postcode: "EC2A 4NE" },
  { fullName: "Ananya Rao", email: "ananya.rao@example.com", phone: "+91 80 4000 1234", city: "Bengaluru", postcode: "560001" },
  { fullName: "Lukas Weber", email: "lukas.weber@example.com", phone: "+49 30 901820", city: "Berlin", postcode: "10115" },
  { fullName: "Sofia Martinez", email: "sofia.m@example.com", phone: "+1 512 555 0177", city: "Austin", postcode: "78701" },
  { fullName: "Kenji Tanaka", email: "kenji.tanaka@example.com", phone: "+81 3 5555 0199", city: "Tokyo", postcode: "100-0001" },
];

export function seedOrders(workspace: string, profileId: ProfileId, now = Date.now()): StoredOrder[] {
  const profile = PROFILES[profileId];
  const year = new Date(now).getUTCFullYear();
  const plans: { id: string; ago: number; stall?: number; recoveredAgo?: number; productIdx: number; scenario: ScenarioId }[] = [
    { id: `NX-${year}-4821`, ago: 3 * 3600_000, productIdx: 0, scenario: "healthy" },
    { id: `NX-${year}-4790`, ago: 26 * 3600_000, productIdx: 2, scenario: "healthy" },
    { id: `NX-${year}-4833`, ago: 47 * 60_000, stall: 2, productIdx: 1, scenario: "stalled_order" },
    { id: `NX-${year}-4836`, ago: 18 * 60_000, stall: 4, productIdx: 3, scenario: "stalled_order" },
    { id: `NX-${year}-4829`, ago: 95 * 60_000, stall: 2, recoveredAgo: 80 * 60_000, productIdx: 0, scenario: "stalled_order" },
    { id: `NX-${year}-4840`, ago: 9_000, productIdx: 1, scenario: "healthy" },
  ];
  return plans.map((p, i) => {
    const c = SEED_CUSTOMERS[i % SEED_CUSTOMERS.length];
    const product = profile.products[p.productIdx];
    const input: CheckoutInput = {
      items: [{ slug: product.slug, variantId: product.variants[0].id, addOnIds: i % 2 ? [profile.addOns[0].id] : [], qty: 1 }],
      customer: { fullName: c.fullName, email: c.email, phone: c.phone },
      address: { line1: `${100 + i * 17} Harbor Street`, city: c.city, postcode: c.postcode },
      journey: { slot: profile.journey.slotOptions[i % profile.journey.slotOptions.length].value, preference: profile.journey.preferenceOptions[0].value },
      payment: { cardName: c.fullName, last4: "4242", expiry: "12/29", brand: "Visa" },
    };
    const order = buildOrder(p.id, workspace, profileId, "healthy", input, now - p.ago);
    order.scenario = p.scenario;
    order.seeded = true;
    if (p.stall !== undefined) {
      const reason = profile.stallReasons.find((r) => r.stageIndex === p.stall) ?? profile.stallReasons[0];
      order.stall = { stageIndex: reason.stageIndex, code: reason.code, reason: reason.reason };
    }
    if (p.recoveredAgo !== undefined) order.recoveredAt = now - p.recoveredAgo;
    return order;
  });
}

// ---------------------------------------------------------- service health

export interface ServiceSample {
  count: number;
  errors: number;
  latencies: number[];
}

function p95(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

export function computeHealth(
  scenario: ScenarioId,
  orders: OrderView[],
  samples: Partial<Record<string, ServiceSample>>,
  now = Date.now(),
): ServiceHealth[] {
  const jitter = (id: string, base: number, spread: number) => base + (hash(`${id}:${Math.floor(now / 5000)}`) % spread);
  const stalled = orders.filter((o) => o.status === "stalled");
  return SERVICES.map((svc) => {
    const s = samples[svc.id];
    const observedP95 = s && s.latencies.length >= 3 ? p95(s.latencies) : 0;
    let status: ServiceHealth["status"] = "Healthy";
    let p95Ms = observedP95 || jitter(svc.id, 48, 60);
    let errorRate = s && s.count ? round2((s.errors / s.count) * 100) : 0;
    let note = "Operating normally.";

    if (scenario === "slow_experience" && (svc.id === "catalog-pricing" || svc.id === "availability-inventory")) {
      status = "Degraded";
      p95Ms = Math.max(p95Ms, jitter(svc.id, 3500, 300));
      note = "Upstream latency injected: responses taking 2.8–3.8 s.";
    }
    if (scenario === "slow_experience" && svc.id === "storefront-edge") {
      status = "Degraded";
      note = "Third-party analytics script adding ~2.5 s to page load.";
    }
    if (scenario === "checkout_failure" && svc.id === "payment-gateway") {
      status = "Critical";
      p95Ms = Math.max(p95Ms, 5000);
      errorRate = Math.max(errorRate, 100);
      note = "Upstream card processor timing out after 5000 ms (HTTP 502).";
    }
    if (scenario === "checkout_failure" && svc.id === "order-orchestrator") {
      status = "Degraded";
      note = "Order creation failing downstream of payment authorization.";
    }
    const affected = stalled.filter((o) => {
      const stage = o.stall?.stageIndex;
      if (svc.id === "order-orchestrator") return true;
      if (svc.id === "availability-inventory") return stage === 2;
      if (svc.id === "provisioning-fulfillment") return stage === 4;
      return false;
    });
    if (affected.length && status === "Healthy") {
      status = svc.id === "order-orchestrator" ? "Degraded" : affected.length > 2 ? "Critical" : "Degraded";
      note = `${affected.length} order(s) blocked by business-rule failures: ${affected[0].stall!.code}.`;
    } else if (scenario === "stalled_order" && svc.id === "order-orchestrator" && status === "Healthy") {
      status = "Degraded";
      note = "New orders will halt at an inventory or provisioning milestone.";
    }
    return { id: svc.id, name: svc.name, description: svc.description, status, p95Ms: Math.round(p95Ms), errorRate, requests: s?.count ?? 0, note };
  });
}
