import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Product } from "../../shared/types";
import { ProductCard, ProductCardSkeleton } from "../components/ProductCard";
import { Banner, Icon, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { cx } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useConfig } from "../state/AppContext";

type Sort = "featured" | "price-asc" | "price-desc" | "rating";

export default function Catalog() {
  const { profile } = useConfig();
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "All";
  const q = params.get("q") ?? "";
  const sort = (params.get("sort") as Sort) ?? "featured";
  const catalog = useAsync((signal) => api<{ products: Product[] }>("/api/catalog", { signal }), [profile.id]);

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "" || (key === "category" && value === "All") || (key === "sort" && value === "featured")) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: key === "q" });
  };

  const products = useMemo(() => {
    let list = catalog.data?.products ?? [];
    if (category !== "All") list = list.filter((p) => p.category === category);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((p) => `${p.name} ${p.tagline} ${p.specs.join(" ")}`.toLowerCase().includes(needle));
    }
    const minPrice = (p: Product) => Math.min(...p.variants.map((v) => v.price));
    if (sort === "price-asc") list = [...list].sort((a, b) => minPrice(a) - minPrice(b));
    if (sort === "price-desc") list = [...list].sort((a, b) => minPrice(b) - minPrice(a));
    if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [catalog.data, category, q, sort]);

  return (
    <div className="container-page py-12">
      <PageHeader eyebrow={profile.brandLine} title={profile.id === "telecom" ? "Plans & services" : "All devices"}>
        {profile.id === "telecom"
          ? "Full-fiber plans for every home and business, with optional resilience and network add-ons."
          : "Precision-built hardware that works beautifully together."}
      </PageHeader>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category" data-testid="category-filters">
          {["All", ...profile.categories].map((c) => (
            <button
              key={c}
              onClick={() => update("category", c)}
              aria-pressed={category === c}
              data-testid={`filter-${c.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              className={cx(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                category === c ? "bg-ink text-white" : "border border-line bg-white text-slate-600 hover:border-slate-300 hover:text-ink",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <label htmlFor="catalog-search" className="sr-only">
              Search
            </label>
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input id="catalog-search" data-testid="input-search" className="input pl-9 sm:w-64" placeholder="Search" value={q} onChange={(e) => update("q", e.target.value)} />
          </div>
          <label htmlFor="catalog-sort" className="sr-only">
            Sort
          </label>
          <select id="catalog-sort" data-testid="select-sort" className="input sm:w-48" value={sort} onChange={(e) => update("sort", e.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="rating">Top rated</option>
          </select>
        </div>
      </div>

      {catalog.state === "error" && (
        <div className="mb-6">
          <Banner tone="error" title="We couldn't load the catalog" testId="catalog-error" action={<button className="btn-ghost" onClick={() => catalog.reload()}>Retry</button>}>
            {catalog.error?.message}
          </Banner>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="catalog-grid" data-state={catalog.state} data-count={products.length}>
        {catalog.state === "loading" || catalog.state === "idle"
          ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)
          : products.map((p) => <ProductCard key={p.slug} product={p} priceSuffix={profile.priceSuffix} />)}
      </div>
      {catalog.state === "success" && products.length === 0 && (
        <div className="card p-10 text-center" data-testid="catalog-empty">
          <p className="font-semibold">No matches</p>
          <p className="mt-1 text-sm text-slate-600">Try a different search or category.</p>
          <Link to="/catalog" className="btn-ghost mt-4">
            Clear filters
          </Link>
        </div>
      )}
    </div>
  );
}
