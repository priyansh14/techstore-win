import { describe, expect, it } from "vitest";
import {
  buildOrder,
  checkAvailability,
  computeHealth,
  luhn,
  materialize,
  priceBasket,
  recoverOrder,
  RECOVERY_DELAY_MS,
  seedOrders,
  STAGE_INTERVAL_MS,
  TEST_CARDS,
  validateCheckout,
} from "../../shared/engine";
import { PROFILES, SCENARIOS } from "../../shared/profiles";
import type { CheckoutInput, ProfileId } from "../../shared/types";

const T0 = Date.UTC(2026, 10, 17, 12, 0, 0);

function input(profile: ProfileId, overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  const p = PROFILES[profile];
  return {
    items: [{ slug: p.products[0].slug, variantId: p.products[0].variants[0].id, addOnIds: [p.addOns[0].id], qty: 2 }],
    customer: { fullName: "Ava Chen", email: "ava@example.com", phone: "+1 415 555 0142" },
    address: { line1: "88 Market Street", city: "San Francisco", postcode: "94105" },
    journey: { slot: p.journey.slotOptions[0].value, preference: p.journey.preferenceOptions[0].value },
    payment: { cardName: "Ava Chen", last4: "4242", expiry: "12/29", brand: "Visa" },
    ...overrides,
  };
}

describe("pricing", () => {
  it("prices lines from the server-side catalog and applies WELCOME10", () => {
    const p = PROFILES.telecom;
    const { lines, totals, promoApplied } = priceBasket(p, input("telecom").items, "welcome10");
    expect(lines[0].unitPrice).toBe(79 + 15);
    expect(totals.subtotal).toBe(188);
    expect(totals.discount).toBe(18.8);
    expect(totals.tax).toBeCloseTo((188 - 18.8) * 0.08, 2);
    expect(totals.total).toBeCloseTo(188 - 18.8 + totals.tax, 2);
    expect(promoApplied).toBe("WELCOME10");
  });

  it("ignores unknown promo codes and unknown items", () => {
    const { lines, totals } = priceBasket(PROFILES.retail, [{ slug: "nope", variantId: "x", addOnIds: [], qty: 1 }, input("retail").items[0]], "BROKEN50");
    expect(lines).toHaveLength(1);
    expect(totals.discount).toBe(0);
  });

  it("clamps quantity to 1–10", () => {
    const { lines } = priceBasket(PROFILES.retail, [{ ...input("retail").items[0], qty: 99 }]);
    expect(lines[0].qty).toBe(10);
  });
});

describe("availability & validation", () => {
  it("is deterministic per postcode and rejects the 000 prefix", () => {
    expect(checkAvailability("telecom", "94105", T0)).toEqual(checkAvailability("telecom", " 94105 ", T0));
    expect(checkAvailability("telecom", "00012").available).toBe(false);
    expect(checkAvailability("retail", "560001").hub.code).toMatch(/^NX-FC-/);
  });

  it("validates a complete checkout and reports field errors", () => {
    expect(validateCheckout(PROFILES.telecom, input("telecom")).ok).toBe(true);
    const bad = validateCheckout(PROFILES.telecom, input("telecom", { customer: { fullName: "", email: "nope", phone: "1" }, items: [] }));
    expect(bad.ok).toBe(false);
    expect(Object.keys(bad.errors)).toEqual(expect.arrayContaining(["fullName", "email", "phone", "items"]));
  });

  it("rejects items from the other profile", () => {
    expect(validateCheckout(PROFILES.retail, input("telecom")).errors.items).toBeDefined();
  });

  it("only accepts valid test card numbers", () => {
    for (const n of Object.keys(TEST_CARDS)) expect(luhn(n)).toBe(true);
    expect(luhn("4242424242424241")).toBe(false);
  });
});

describe("order state machine", () => {
  it("advances one milestone every interval and completes after six", () => {
    const order = buildOrder("NX-2026-0001", "t", "telecom", "healthy", input("telecom"), T0);
    expect(materialize(order, T0).completedStages).toBe(1);
    expect(materialize(order, T0).currentMilestone).toBe("Customer validated");
    expect(materialize(order, T0 + STAGE_INTERVAL_MS * 2).completedStages).toBe(3);
    const done = materialize(order, T0 + STAGE_INTERVAL_MS * 5);
    expect(done.status).toBe("completed");
    expect(done.events.map((e) => e.milestone)).toEqual(PROFILES.telecom.milestones.map((m) => m.label));
    expect(done.milestones.every((m) => m.state === "done")).toBe(true);
  });

  it("uses profile-specific milestone names", () => {
    const order = buildOrder("NX-2026-0002", "t", "retail", "healthy", input("retail"), T0);
    const view = materialize(order, T0 + 60_000);
    expect(view.milestones.map((m) => m.label)).toEqual([
      "Order received",
      "Payment & fraud validated",
      "Warehouse stock reserved",
      "Order accepted",
      "Dispatch & carrier handoff",
      "Delivered",
    ]);
  });

  it("stalls at milestone 3 or 5 under stalled_order and never progresses on its own", () => {
    for (let i = 0; i < 20; i++) {
      const order = buildOrder(`NX-2026-${1000 + i}`, "t", "telecom", "stalled_order", input("telecom"), T0);
      expect([2, 4]).toContain(order.stall!.stageIndex);
      const view = materialize(order, T0 + 3_600_000);
      expect(view.status).toBe("stalled");
      expect(view.completedStages).toBe(order.stall!.stageIndex);
      expect(view.milestones[order.stall!.stageIndex].state).toBe("failed");
      const blocked = view.events.find((e) => e.businessOutcome === "Blocked")!;
      expect(blocked.technicalStatus).toBe("200 OK");
      expect(blocked.detail).toContain(order.stall!.code);
    }
  });

  it("is in progress (not stalled) until the stall point is reached", () => {
    const order = buildOrder("NX-2026-2000", "t", "retail", "stalled_order", input("retail"), T0);
    const before = materialize(order, T0 + order.stall!.stageIndex * STAGE_INTERVAL_MS - 1);
    expect(before.status).toBe("in_progress");
    expect(before.stall).toBeUndefined();
  });

  it("recovers a stalled order and completes the remaining milestones in order", () => {
    const order = buildOrder("NX-2026-3000", "t", "telecom", "stalled_order", input("telecom"), T0);
    const s = order.stall!.stageIndex;
    const retryAt = T0 + 60_000;
    const recovered = recoverOrder(order, retryAt);
    expect(materialize(recovered, retryAt).status).toBe("in_progress");
    const end = retryAt + RECOVERY_DELAY_MS + (5 - s) * STAGE_INTERVAL_MS;
    const view = materialize(recovered, end);
    expect(view.status).toBe("completed");
    expect(view.events.map((e) => e.businessOutcome)).toContain("Recovered");
    const times = view.events.map((e) => e.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("never schedules a recovery before the stall itself", () => {
    const order = buildOrder("NX-2026-3001", "t", "telecom", "stalled_order", input("telecom"), T0);
    const early = recoverOrder(order, T0 + 1);
    const view = materialize(early, T0 + 120_000);
    const times = view.events.map((e) => e.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(view.status).toBe("completed");
  });

  it("checkout_failure and slow_experience orders progress normally once created", () => {
    for (const scenario of ["slow_experience", "checkout_failure"] as const) {
      const order = buildOrder("NX-2026-4000", "t", "retail", scenario, input("retail"), T0);
      expect(order.stall).toBeUndefined();
      expect(materialize(order, T0 + 30_000).status).toBe("completed");
    }
  });
});

describe("scenario engine & health", () => {
  it("defines the five scenarios", () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(["healthy", "slow_experience", "third_party_slow", "checkout_failure", "stalled_order"]);
  });

  it("seeds completed, in-progress and stalled demo orders including NX-YYYY-4821", () => {
    const views = seedOrders("t", "telecom", T0).map((o) => materialize(o, T0));
    expect(views.find((o) => o.id === "NX-2026-4821")?.status).toBe("completed");
    expect(new Set(views.map((o) => o.status))).toEqual(new Set(["completed", "in_progress", "stalled"]));
  });

  it("maps scenarios to service health", () => {
    const status = (scenario: Parameters<typeof computeHealth>[0], id: string) => computeHealth(scenario, [], {}, T0).find((s) => s.id === id)!.status;
    expect(computeHealth("healthy", [], {}, T0).every((s) => s.status === "Healthy")).toBe(true);
    expect(status("slow_experience", "catalog-pricing")).toBe("Degraded");
    expect(status("slow_experience", "availability-inventory")).toBe("Degraded");
    expect(status("checkout_failure", "payment-gateway")).toBe("Critical");
    expect(status("stalled_order", "order-orchestrator")).toBe("Degraded");
  });

  it("flags services affected by stalled orders", () => {
    const stalled = seedOrders("t", "retail", T0).map((o) => materialize(o, T0));
    const health = computeHealth("healthy", stalled, {}, T0);
    expect(health.find((s) => s.id === "availability-inventory")!.status).not.toBe("Healthy");
    expect(health.find((s) => s.id === "provisioning-fulfillment")!.status).not.toBe("Healthy");
  });
});
