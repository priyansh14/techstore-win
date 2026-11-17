import type { ProfileDefinition, ProfileId, ScenarioDefinition, ScenarioId, ServiceId } from "./types";

export const telecom: ProfileDefinition = {
  id: "telecom",
  label: "Nexora Fiber & Connectivity",
  brandLine: "Fiber & Connectivity",
  hero: {
    eyebrow: "Full-fiber, symmetrical, engineered for uptime",
    title: "Internet that keeps up with everything you build.",
    subtitle:
      "Symmetrical full-fiber for homes and businesses, Wi-Fi 7 hardware included, and a 5G failover option that switches over before you notice.",
    cta: "Explore plans",
  },
  priceSuffix: "/mo",
  taxRate: 0.08,
  categories: ["Home Fiber", "Business", "Resilience"],
  products: [
    {
      slug: "fiber-1g",
      name: "Nexora Fiber 1 Gbps",
      tagline: "Symmetrical 1000 Mbps full-fiber",
      description:
        "Symmetrical 1000 Mbps FTTH with a Wi-Fi 7 router included and truly unlimited data. Built for 4K streaming households, creators, and remote teams.",
      category: "Home Fiber",
      specs: ["1000 / 1000 Mbps", "Wi-Fi 7 router included", "Unlimited data", "Sub-5 ms local latency"],
      variants: [
        { id: "12m", label: "12-Month Contract", price: 79, note: "Best value" },
        { id: "monthly", label: "No-Lock Monthly", price: 89 },
      ],
      badge: "Most popular",
      rating: 4.8,
      reviews: 2140,
    },
    {
      slug: "fiber-300m",
      name: "Nexora Fiber 300 Mbps",
      tagline: "Everyday ultra-reliable home fiber",
      description:
        "Everyday ultra-reliable home fiber broadband with a Wi-Fi 6E router included. More than enough for video calls, streaming and gaming in a busy home.",
      category: "Home Fiber",
      specs: ["300 / 300 Mbps", "Wi-Fi 6E router included", "Unlimited data", "Free standard installation"],
      variants: [
        { id: "12m", label: "12-Month Contract", price: 49, note: "Best value" },
        { id: "monthly", label: "No-Lock Monthly", price: 57 },
      ],
      rating: 4.7,
      reviews: 3312,
    },
    {
      slug: "biz-2g",
      name: "Nexora Business Dedicated 2 Gbps",
      tagline: "Dedicated fiber with a 99.95% SLA",
      description:
        "Uncontended, dedicated symmetrical fiber backed by a 99.95% availability SLA and 4-hour priority engineer response, monitored around the clock.",
      category: "Business",
      specs: ["2 Gbps dedicated", "99.95% availability SLA", "4-hour engineer response", "Proactive NOC monitoring"],
      variants: [
        { id: "standard", label: "Standard SLA", price: 399 },
        { id: "mission", label: "24x7 Mission-Critical SLA", price: 549, note: "2-hour response" },
      ],
      badge: "Business",
      rating: 4.9,
      reviews: 418,
    },
    {
      slug: "backup-5g",
      name: "Nexora 5G Backup Failover Kit",
      tagline: "Automatic sub-second cellular failover",
      description:
        "A dual-SIM LTE/5G gateway that sits beside your router and fails over in under a second, so payments, calls and VPNs keep running during an outage.",
      category: "Resilience",
      specs: ["Sub-second failover", "Dual-SIM 5G / LTE", "Plug-and-play setup", "Outage alerts by SMS"],
      variants: [
        { id: "50gb", label: "50 GB Failover Pool", price: 19 },
        { id: "unlimited", label: "Unlimited Failover Pool", price: 35 },
      ],
      rating: 4.6,
      reviews: 905,
    },
  ],
  addOns: [
    { id: "static-ip", name: "Static IPv4 Block (/29)", description: "Five usable public IPv4 addresses for servers, VPNs and cameras.", price: 15 },
    { id: "mesh-node", name: "Whole-Home Wi-Fi 7 Mesh Node", description: "Extra mesh node for dead-zone-free coverage in larger homes.", price: 9 },
  ],
  milestones: [
    { key: "received", label: "Order received", service: "order-orchestrator", description: "Your order has been captured and assigned a reference." },
    { key: "validated", label: "Customer validated", service: "payment-gateway", description: "Identity, contact details and payment method verified." },
    { key: "availability", label: "Line availability checked", service: "availability-inventory", description: "Fiber port and exchange capacity confirmed for your address." },
    { key: "accepted", label: "Order accepted", service: "order-orchestrator", description: "Your order is confirmed and scheduled with our network team." },
    { key: "provisioning", label: "ONT & circuit provisioning started", service: "provisioning-fulfillment", description: "Optical terminal and circuit are being configured on the network." },
    { key: "active", label: "Service active", service: "provisioning-fulfillment", description: "Your connection is live. Welcome to Nexora Fiber." },
  ],
  availability: {
    title: "Check fiber availability",
    inputLabel: "Service postcode / PIN",
    placeholder: "e.g. 94105 or 560001",
    hubNoun: "Exchange",
    hubs: [
      { code: "NX-EX-14", name: "Harbor Point Exchange", region: "Metro North" },
      { code: "NX-EX-22", name: "Riverside Exchange", region: "Metro Central" },
      { code: "NX-EX-31", name: "Westgate Exchange", region: "Metro West" },
      { code: "NX-EX-47", name: "Summit Ridge Exchange", region: "Metro East" },
      { code: "NX-EX-58", name: "Lakeside Exchange", region: "Metro South" },
    ],
  },
  journey: {
    slotLabel: "Installation window",
    slotOptions: [
      { value: "morning", label: "Morning 09:00–12:00", note: "Engineer visit" },
      { value: "afternoon", label: "Afternoon 13:00–17:00", note: "Engineer visit" },
      { value: "self-install", label: "Self-Install Kit", note: "Shipped in 1–2 days" },
    ],
    preferenceLabel: "Router preference",
    preferenceOptions: [
      { value: "nexora-router", label: "Nexora router (included)" },
      { value: "byo-router", label: "Bring my own router" },
    ],
    addressLabel: "Service address",
    showTaxInvoice: false,
  },
  guarantees: [
    { title: "99.95% network uptime", body: "Backed by service credits, measured every minute." },
    { title: "Next-day installation", body: "Engineer slots available in most metro areas." },
    { title: "No-surprise pricing", body: "Locked monthly price, no setup fees on contract plans." },
    { title: "24/7 local support", body: "Real engineers, median answer time under 90 seconds." },
  ],
  stallReasons: [
    { stageIndex: 2, code: "SPLITTER_PORT_TIMEOUT", reason: "Regional provisioning rule failed: Optical splitter port reservation timeout" },
    { stageIndex: 4, code: "OLT_PROFILE_REJECTED", reason: "Circuit provisioning rule failed: OLT service profile rejected by network inventory" },
  ],
};

export const retail: ProfileDefinition = {
  id: "retail",
  label: "Nexora Devices & Hardware",
  brandLine: "Devices & Hardware",
  hero: {
    eyebrow: "Precision-built hardware, delivered fast",
    title: "Tools for focused, beautiful work.",
    subtitle:
      "Workstation laptops, studio audio and whole-home Wi-Fi 7, designed to work together and delivered as soon as tomorrow.",
    cta: "Shop devices",
  },
  priceSuffix: "",
  taxRate: 0.08,
  categories: ["Laptops", "Audio", "Accessories", "Networking"],
  products: [
    {
      slug: "studiobook-14",
      name: "Nexora StudioBook Pro 14",
      tagline: "14\" OLED 120Hz workstation laptop",
      description:
        "A precision CNC aluminum workstation with a 14\" OLED 120Hz display, all-day battery and a whisper-quiet thermal design for sustained performance.",
      category: "Laptops",
      specs: ["14\" OLED 120Hz, 2880×1800", "CNC aluminum unibody", "Up to 20 h battery", "Thunderbolt 4 ×3"],
      variants: [
        { id: "16-512", label: "16GB / 512GB SSD", price: 1899 },
        { id: "32-1tb", label: "32GB / 1TB SSD", price: 2399, note: "Pro choice" },
      ],
      badge: "New",
      rating: 4.8,
      reviews: 1287,
    },
    {
      slug: "aero-anc",
      name: "Nexora Aero ANC Headphones",
      tagline: "Adaptive hybrid noise cancelling",
      description:
        "Studio-tuned wireless headphones with adaptive hybrid noise cancelling, multipoint Bluetooth and a 45-hour battery that charges to 5 hours in 10 minutes.",
      category: "Audio",
      specs: ["Adaptive hybrid ANC", "45-hour battery", "Multipoint Bluetooth 5.4", "Hi-Res wireless audio"],
      variants: [
        { id: "obsidian", label: "Obsidian Matte", price: 349 },
        { id: "silver", label: "Silver Frost", price: 349 },
      ],
      rating: 4.7,
      reviews: 4021,
    },
    {
      slug: "dockone-hub",
      name: "Nexora DockOne Thunderbolt Hub",
      tagline: "12-in-1 Thunderbolt 4 dock",
      description:
        "One cable for everything: dual 4K displays, 2.5 GbE, SD UHS-II and 96W host charging in a machined aluminum desktop dock.",
      category: "Accessories",
      specs: ["12 ports, Thunderbolt 4", "96W host charging", "Dual 4K @ 60 Hz", "2.5 Gb Ethernet"],
      variants: [
        { id: "standard", label: "Standard 0.8m Cable", price: 279 },
        { id: "pro", label: "Pro 2m Braided Cable", price: 319 },
      ],
      rating: 4.6,
      reviews: 862,
    },
    {
      slug: "wifi7-mesh",
      name: "Nexora Wi-Fi 7 Mesh Tri-Pack",
      tagline: "Whole-home tri-band Wi-Fi 7",
      description:
        "Tri-band Wi-Fi 7 mesh with 320 MHz channels and multi-link operation, covering up to 6,500 sq. ft. with a single seamless network.",
      category: "Networking",
      specs: ["Tri-band Wi-Fi 7", "Up to 6,500 sq. ft.", "Multi-link operation", "10 GbE backhaul port"],
      variants: [
        { id: "2-pack", label: "2-Pack", price: 499 },
        { id: "3-pack", label: "3-Pack", price: 699, note: "Whole-home" },
      ],
      badge: "Best seller",
      rating: 4.8,
      reviews: 2609,
    },
  ],
  addOns: [
    { id: "care-plus", name: "Nexora Care+ 2-Year Accidental Protection", description: "Two years of accidental damage cover with express replacement.", price: 129 },
    { id: "express-courier", name: "Priority Express Courier", description: "Priority handling and a dedicated courier slot.", price: 25 },
  ],
  milestones: [
    { key: "received", label: "Order received", service: "order-orchestrator", description: "Your order has been captured and assigned a reference." },
    { key: "payment", label: "Payment & fraud validated", service: "payment-gateway", description: "Payment authorized and fraud screening passed." },
    { key: "stock", label: "Warehouse stock reserved", service: "availability-inventory", description: "Units reserved at your nearest fulfillment center." },
    { key: "accepted", label: "Order accepted", service: "order-orchestrator", description: "Your order is confirmed and queued for picking." },
    { key: "dispatch", label: "Dispatch & carrier handoff", service: "provisioning-fulfillment", description: "Packed, labelled and handed to the carrier." },
    { key: "delivered", label: "Delivered", service: "provisioning-fulfillment", description: "Delivered. Enjoy your new Nexora gear." },
  ],
  availability: {
    title: "Check delivery & stock",
    inputLabel: "Delivery postcode / PIN",
    placeholder: "e.g. 94105 or 560001",
    hubNoun: "Fulfillment center",
    hubs: [
      { code: "NX-FC-02", name: "Bayview Fulfillment Center", region: "West" },
      { code: "NX-FC-07", name: "Central Plains Fulfillment Center", region: "Central" },
      { code: "NX-FC-11", name: "Northgate Fulfillment Center", region: "North" },
      { code: "NX-FC-16", name: "Coastal Fulfillment Center", region: "East" },
      { code: "NX-FC-21", name: "Southpoint Fulfillment Center", region: "South" },
    ],
  },
  journey: {
    slotLabel: "Delivery speed",
    slotOptions: [
      { value: "standard", label: "Standard 2-Day", note: "Free" },
      { value: "next-day", label: "Next-Day Express", note: "Order by 8 pm" },
    ],
    preferenceLabel: "Delivery preference",
    preferenceOptions: [
      { value: "door", label: "Leave at door" },
      { value: "signature", label: "Signature required" },
    ],
    addressLabel: "Delivery address",
    showTaxInvoice: true,
  },
  guarantees: [
    { title: "Next-day delivery", body: "Order by 8 pm for next-day express to most postcodes." },
    { title: "30-day returns", body: "Free returns on every device, no questions asked." },
    { title: "2-year warranty", body: "Every Nexora device, extendable with Care+." },
    { title: "Secure checkout", body: "Tokenized payments and real-time fraud screening." },
  ],
  stallReasons: [
    { stageIndex: 2, code: "SKU_LOCK_CONFLICT", reason: "Warehouse allocation rule failed: Batch SKU lock conflict" },
    { stageIndex: 4, code: "CARRIER_MANIFEST_REJECTED", reason: "Carrier handoff rule failed: Manifest rejected by carrier label service" },
  ],
};

export const PROFILES: Record<ProfileId, ProfileDefinition> = { telecom, retail };
export const DEFAULT_PROFILE: ProfileId = "telecom";
export const isProfileId = (v: unknown): v is ProfileId => v === "telecom" || v === "retail";

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: "healthy",
    label: "Healthy",
    summary: "Fast APIs, successful checkout, orders complete end to end.",
    customerExperience: "Pages and availability checks respond in under 150 ms. Orders advance through all six milestones in about 20 seconds.",
    telemetrySignals: ["API responses 40–120 ms", "All synthetic steps pass", "Conversions recorded", "All services Healthy"],
  },
  {
    id: "slow_experience",
    label: "Slow Experience",
    summary: "Latency injected on catalog and availability plus a slow third-party script.",
    customerExperience: "Product listings and availability checks take 3–4 seconds. A slow analytics script delays the page load event. The journey still completes.",
    telemetrySignals: ["Catalog & availability APIs 2.8–3.8 s", "Third-party script +2.5 s in waterfall", "Higher page load and step timings", "Catalog & Availability Degraded"],
  },
  {
    id: "checkout_failure",
    label: "Checkout Failure",
    summary: "Payment authorization times out with HTTP 502.",
    customerExperience: "Everything works until the customer places the order. Checkout then fails with a payment gateway error after about 5 seconds.",
    telemetrySignals: ["POST /api/orders → 502 PAYMENT_GATEWAY_TIMEOUT", "Failed synthetic transaction step", "Checkout funnel drop-off", "Payment Gateway Critical, /api/health 503"],
  },
  {
    id: "stalled_order",
    label: "Stalled Order",
    summary: "Checkout succeeds but the order halts on a backend business rule.",
    customerExperience: "The customer sees a valid confirmation page, but tracking stops at an inventory or provisioning milestone with a business-rule error.",
    telemetrySignals: ["All HTTP calls return 200", "Order stuck at milestone 3 or 5", "Business outcome: Blocked", "Order Orchestrator Degraded"],
  },
];

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id);
export const isScenarioId = (v: unknown): v is ScenarioId => typeof v === "string" && (SCENARIO_IDS as string[]).includes(v);

export const SERVICES: { id: ServiceId; name: string; description: string }[] = [
  { id: "storefront-edge", name: "Storefront Edge", description: "Global edge delivery of the storefront and API gateway." },
  { id: "catalog-pricing", name: "Catalog & Pricing Service", description: "Product catalog, variants, add-ons and live pricing." },
  { id: "availability-inventory", name: "Availability & Inventory API", description: "Coverage, line capacity and warehouse stock checks." },
  { id: "payment-gateway", name: "Payment Gateway Adapter", description: "Card authorization and fraud screening via upstream processor." },
  { id: "order-orchestrator", name: "Order Orchestrator", description: "Order capture, state machine and business-rule evaluation." },
  { id: "provisioning-fulfillment", name: "Provisioning & Fulfillment Engine", description: "Network provisioning, warehouse dispatch and delivery." },
];

export const serviceName = (id: ServiceId) => SERVICES.find((s) => s.id === id)?.name ?? id;
