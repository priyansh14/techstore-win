export type ProfileId = "telecom" | "retail";
export type ScenarioId = "healthy" | "slow_experience" | "checkout_failure" | "stalled_order";
export type ServiceId =
  | "storefront-edge"
  | "catalog-pricing"
  | "availability-inventory"
  | "payment-gateway"
  | "order-orchestrator"
  | "provisioning-fulfillment";

export interface Variant {
  id: string;
  label: string;
  price: number;
  note?: string;
}

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  specs: string[];
  variants: Variant[];
  badge?: string;
  rating: number;
  reviews: number;
}

export interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface Milestone {
  key: string;
  label: string;
  service: ServiceId;
  description: string;
}

export interface SelectOption {
  value: string;
  label: string;
  note?: string;
}

export interface ProfileDefinition {
  id: ProfileId;
  label: string;
  brandLine: string;
  hero: { eyebrow: string; title: string; subtitle: string; cta: string };
  priceSuffix: string;
  taxRate: number;
  categories: string[];
  products: Product[];
  addOns: AddOn[];
  milestones: Milestone[];
  availability: {
    title: string;
    inputLabel: string;
    placeholder: string;
    hubNoun: string;
    hubs: { code: string; name: string; region: string }[];
  };
  journey: {
    slotLabel: string;
    slotOptions: SelectOption[];
    preferenceLabel: string;
    preferenceOptions: SelectOption[];
    addressLabel: string;
    showTaxInvoice: boolean;
  };
  guarantees: { title: string; body: string }[];
  stallReasons: { stageIndex: number; code: string; reason: string }[];
}

export interface BasketLine {
  slug: string;
  variantId: string;
  addOnIds: string[];
  qty: number;
}

export interface PricedLine extends BasketLine {
  name: string;
  variantLabel: string;
  addOnNames: string[];
  unitPrice: number;
  lineTotal: number;
}

export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export interface CheckoutInput {
  items: BasketLine[];
  promoCode?: string;
  customer: { fullName: string; email: string; phone: string };
  address: { line1: string; line2?: string; city: string; postcode: string };
  journey: { slot: string; preference: string; taxInvoice?: boolean; taxId?: string };
  payment: { cardName: string; last4: string; expiry: string; brand: string };
}

export interface StallInfo {
  stageIndex: number;
  code: string;
  reason: string;
}

export interface StoredOrder {
  id: string;
  workspace: string;
  profile: ProfileId;
  scenario: ScenarioId;
  createdAt: number;
  customer: CheckoutInput["customer"];
  address: CheckoutInput["address"];
  journey: CheckoutInput["journey"];
  payment: { last4: string; brand: string };
  lines: PricedLine[];
  promoCode?: string;
  totals: Totals;
  stall?: StallInfo;
  recoveredAt?: number;
  seeded?: boolean;
}

export type OrderStatus = "in_progress" | "completed" | "stalled";

export interface OrderEvent {
  id: string;
  stageIndex: number;
  milestone: string;
  at: number;
  service: ServiceId;
  latencyMs: number;
  technicalStatus: string;
  businessOutcome: "Completed" | "Blocked" | "Retry requested" | "Recovered";
  detail?: string;
}

export interface MilestoneState {
  key: string;
  label: string;
  description: string;
  service: ServiceId;
  state: "done" | "current" | "pending" | "failed";
  at?: number;
}

export interface OrderView extends Omit<StoredOrder, "stall" | "recoveredAt"> {
  status: OrderStatus;
  completedStages: number;
  currentMilestone: string;
  milestones: MilestoneState[];
  events: OrderEvent[];
  stall?: StallInfo & { at: number; active: boolean };
  recoveredAt?: number;
  updatedAt: number;
}

export interface Availability {
  available: boolean;
  postcode: string;
  hub: { code: string; name: string; region: string };
  distanceKm: number;
  status: string;
  detail: string;
  eta: string;
  checkedAt: number;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  label: string;
  summary: string;
  customerExperience: string;
  telemetrySignals: string[];
}

export interface ServiceHealth {
  id: ServiceId;
  name: string;
  description: string;
  status: "Healthy" | "Degraded" | "Critical";
  p95Ms: number;
  errorRate: number;
  requests: number;
  note: string;
}

export interface WorkspaceSnapshot {
  workspace: string;
  profile: ProfileId;
  scenario: ScenarioId;
  scenarioSetAt: number;
  scenarioExpiresAt?: number;
  orderCount: number;
}

export interface ConfigResponse {
  workspace: string;
  profile: ProfileDefinition;
  scenario: ScenarioId;
  scenarioSource: "workspace" | "session";
  profileSource: "workspace" | "session";
  workspaceState: WorkspaceSnapshot;
  scenarios: ScenarioDefinition[];
  serverTime: number;
}
