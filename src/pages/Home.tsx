import { Link } from "react-router-dom";
import type { Product } from "../../shared/types";
import { AvailabilityChecker } from "../components/AvailabilityChecker";
import { ProductCard, ProductCardSkeleton } from "../components/ProductCard";
import { ProductIllustration } from "../components/ProductIllustration";
import { Icon } from "../components/ui";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useConfig } from "../state/AppContext";

export default function Home() {
  const { profile } = useConfig();
  const catalog = useAsync((signal) => api<{ products: Product[] }>("/api/catalog", { signal }), [profile.id]);
  const hero = profile.products[0];

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_20%,#EEF2FF_0%,transparent_70%)]" aria-hidden="true" />
        <div className="container-page relative grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="eyebrow mb-4" data-testid="hero-eyebrow">
              {profile.hero.eyebrow}
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl" data-testid="hero-title">
              {profile.hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">{profile.hero.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/catalog" className="btn-primary h-12 px-6" data-testid="btn-hero-cta">
                {profile.hero.cta} <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <Link to="/orders" className="btn-ghost h-12 px-6" data-testid="btn-hero-track">
                Track an order
              </Link>
            </div>
            <div className="mt-10 max-w-xl rounded-3xl border border-line bg-white/90 p-4 shadow-xl shadow-slate-900/5 backdrop-blur">
              <p className="mb-3 px-1 text-sm font-semibold">{profile.availability.title}</p>
              <AvailabilityChecker variant="hero" />
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="overflow-hidden rounded-[2rem] border border-line shadow-2xl shadow-indigo-900/10">
              <ProductIllustration slug={hero.slug} label={hero.name} width={640} height={400} className="w-full" />
            </div>
            <div className="absolute -bottom-6 -left-6 rounded-2xl border border-line bg-white p-4 shadow-lg">
              <p className="text-xs text-slate-500">Featured</p>
              <p className="font-semibold">{hero.name}</p>
              <p className="text-sm text-accent">{hero.tagline}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-surface" aria-label="Our guarantees">
        <div className="container-page grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4" data-testid="guarantees">
          {profile.guarantees.map((g, i) => (
            <div key={g.title} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon name={(["shield", "truck", "bolt", "clock"] as const)[i % 4]} />
              </span>
              <div>
                <p className="font-semibold">{g.title}</p>
                <p className="text-sm text-slate-600">{g.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="featured-heading">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">{profile.brandLine}</p>
            <h2 id="featured-heading" className="text-3xl font-semibold tracking-tight">
              {profile.id === "telecom" ? "Choose your connection" : "Featured devices"}
            </h2>
          </div>
          <Link to="/catalog" className="text-sm font-semibold text-accent hover:text-accent-dark" data-testid="link-view-all">
            View all →
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" data-testid="featured-grid" data-state={catalog.state}>
          {catalog.state === "success" && catalog.data
            ? catalog.data.products.slice(0, 4).map((p) => <ProductCard key={p.slug} product={p} priceSuffix={profile.priceSuffix} />)
            : catalog.state === "error"
              ? profile.products.map((p) => <ProductCard key={p.slug} product={p} priceSuffix={profile.priceSuffix} />)
              : Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </section>

      <section className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-8 py-12 text-white sm:px-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_90%_10%,rgba(99,102,241,0.45),transparent)]" aria-hidden="true" />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Already ordered?</h2>
              <p className="mt-2 max-w-lg text-slate-300">
                Follow every step live, from {profile.milestones[0].label.toLowerCase()} to {profile.milestones[5].label.toLowerCase()}.
              </p>
            </div>
            <Link to="/orders" className="btn bg-white text-ink hover:bg-slate-100" data-testid="btn-track-banner">
              Track your order <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
