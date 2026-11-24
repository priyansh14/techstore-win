import { DurableObject } from "cloudflare:workers";
import { buildOrder, materialize, newOrderId, recoverOrder, seedOrders, type ServiceSample } from "../shared/engine";
import { DEFAULT_PROFILE } from "../shared/profiles";
import type { CheckoutInput, ProfileId, ScenarioId, ScenarioRegion, StoredOrder, WorkspaceSnapshot } from "../shared/types";

const MAX_ORDERS = 200;
/** Scenario changes on the shared public workspace revert automatically so real visitors aren't stuck in a fault. */
export const PUBLIC_SCENARIO_TTL_MS = 20 * 60_000;
const SAMPLE_WINDOW = 60;

interface Meta {
  profile: ProfileId;
  scenario: ScenarioId;
  scenarioSetAt: number;
  scenarioExpiresAt?: number;
  scenarioRegion?: ScenarioRegion;
  initialized: true;
}

/**
 * One Durable Object per workspace. Strongly consistent storage means an order created
 * in one region is immediately visible to a tracker polling from any other region.
 */
export class WorkspaceStore extends DurableObject<Env> {
  private samples: Record<string, ServiceSample> = {};
  /** Cached order count, so a snapshot doesn't list (and bill a read for) every stored order. */
  private orderCount: number | undefined;

  private async meta(workspace: string): Promise<Meta> {
    let meta = await this.ctx.storage.get<Meta>("meta");
    if (!meta) {
      meta = { profile: DEFAULT_PROFILE, scenario: "healthy", scenarioSetAt: Date.now(), initialized: true };
      await this.ctx.storage.put("meta", meta);
      await this.putOrders(seedOrders(workspace, meta.profile));
    }
    if (meta.scenarioExpiresAt && meta.scenarioExpiresAt <= Date.now()) {
      meta = { ...meta, scenario: "healthy", scenarioSetAt: Date.now(), scenarioExpiresAt: undefined, scenarioRegion: "all" };
      await this.ctx.storage.put("meta", meta);
    }
    return meta;
  }

  private async putOrders(orders: StoredOrder[]) {
    this.orderCount = undefined;
    const entries: Record<string, StoredOrder> = {};
    for (const o of orders) entries[`order:${o.id}`] = o;
    await this.ctx.storage.put(entries);
  }

  private async allOrders(): Promise<StoredOrder[]> {
    const map = await this.ctx.storage.list<StoredOrder>({ prefix: "order:" });
    return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  async snapshot(workspace: string): Promise<WorkspaceSnapshot> {
    const meta = await this.meta(workspace);
    this.orderCount ??= (await this.ctx.storage.list({ prefix: "order:" })).size;
    const count = this.orderCount;
    return {
      workspace,
      profile: meta.profile,
      scenario: meta.scenario,
      scenarioSetAt: meta.scenarioSetAt,
      scenarioExpiresAt: meta.scenarioExpiresAt,
      scenarioRegion: meta.scenarioRegion ?? "all",
      orderCount: count,
    };
  }

  async update(workspace: string, patch: { profile?: ProfileId; scenario?: ScenarioId; region?: ScenarioRegion }): Promise<WorkspaceSnapshot> {
    const meta = await this.meta(workspace);
    const next: Meta = { ...meta };
    if (patch.profile) next.profile = patch.profile;
    if (patch.region) next.scenarioRegion = patch.region;
    if (patch.scenario) {
      next.scenario = patch.scenario;
      next.scenarioSetAt = Date.now();
      next.scenarioExpiresAt = workspace === "public" && patch.scenario !== "healthy" ? Date.now() + PUBLIC_SCENARIO_TTL_MS : undefined;
    }
    await this.ctx.storage.put("meta", next);
    return this.snapshot(workspace);
  }

  async reset(workspace: string): Promise<WorkspaceSnapshot> {
    this.orderCount = undefined;
    const meta = await this.meta(workspace);
    const keys = [...(await this.ctx.storage.list({ prefix: "order:" })).keys()];
    for (let i = 0; i < keys.length; i += 128) await this.ctx.storage.delete(keys.slice(i, i + 128));
    await this.ctx.storage.put("meta", { ...meta, scenario: "healthy", scenarioSetAt: Date.now(), scenarioExpiresAt: undefined, scenarioRegion: "all" });
    this.samples = {};
    return this.snapshot(workspace);
  }

  async seed(workspace: string, profile?: ProfileId): Promise<WorkspaceSnapshot> {
    const meta = await this.meta(workspace);
    await this.putOrders(seedOrders(workspace, profile ?? meta.profile));
    return this.snapshot(workspace);
  }

  async listOrders(workspace: string): Promise<StoredOrder[]> {
    await this.meta(workspace);
    return this.allOrders();
  }

  async getOrder(workspace: string, id: string): Promise<StoredOrder | null> {
    await this.meta(workspace);
    return (await this.ctx.storage.get<StoredOrder>(`order:${id}`)) ?? null;
  }

  async createOrder(workspace: string, profile: ProfileId, scenario: ScenarioId, input: CheckoutInput): Promise<StoredOrder> {
    this.orderCount = undefined;
    await this.meta(workspace);
    const existing = await this.allOrders();
    const order = buildOrder(newOrderId(new Set(existing.map((o) => o.id))), workspace, profile, scenario, input);
    await this.ctx.storage.put(`order:${order.id}`, order);
    if (existing.length >= MAX_ORDERS) {
      await this.ctx.storage.delete(existing.slice(MAX_ORDERS - 1).map((o) => `order:${o.id}`));
    }
    return order;
  }

  /** Only an order whose stall is currently active can be retried. */
  async retryOrder(workspace: string, id: string): Promise<{ order: StoredOrder; retried: boolean } | null> {
    const order = await this.getOrder(workspace, id);
    if (!order) return null;
    if (materialize(order).status !== "stalled") return { order, retried: false };
    const recovered = recoverOrder(order);
    await this.ctx.storage.put(`order:${id}`, recovered);
    return { order: recovered, retried: true };
  }

  /** Records one request against several services in a single Durable Object call. */
  async track(samples: { service: string; ms: number; ok: boolean }[]): Promise<void> {
    for (const { service, ms, ok } of samples) {
      const s = (this.samples[service] ??= { count: 0, errors: 0, latencies: [] });
      s.count++;
      if (!ok) s.errors++;
      s.latencies.push(ms);
      if (s.latencies.length > SAMPLE_WINDOW) s.latencies.shift();
    }
  }

  async getSamples(): Promise<Record<string, ServiceSample>> {
    return this.samples;
  }
}
