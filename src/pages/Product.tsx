import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AddOn, Availability, Product as ProductT } from "../../shared/types";
import { AvailabilityChecker } from "../components/AvailabilityChecker";
import { ProductCard } from "../components/ProductCard";
import { ProductIllustration } from "../components/ProductIllustration";
import { Banner, Icon, Price, Stars } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { cx, money } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { useApp, useConfig } from "../state/AppContext";

export default function Product() {
  const { slug = "" } = useParams();
  const { profile } = useConfig();
  const { addToBasket } = useApp();
  const navigate = useNavigate();
  const res = useAsync((signal) => api<{ products: ProductT[]; addOns: AddOn[] }>(`/api/catalog?slug=${encodeURIComponent(slug)}`, { signal }), [slug, profile.id]);
  const product = res.data?.products[0];
  const recs = useAsync(
    (signal) => api<{ products: ProductT[] }>(`/api/recommendations?slug=${encodeURIComponent(slug)}`, { signal }),
    [slug, profile.id],
  );
  const addOns = res.data?.addOns ?? [];

  const [variantId, setVariantId] = useState<string>();
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setVariantId(product?.variants[0].id);
    setSelectedAddOns([]);
    setQty(1);
    setAvailability(null);
    setAdded(false);
  }, [product?.slug]);

  if (res.state === "loading" || res.state === "idle") return <ProductSkeleton />;
  if (res.state === "error" || !product) {
    const notFound = res.error instanceof ApiError && res.error.status === 404;
    return (
      <div className="container-page py-16">
        <Banner
          tone={notFound ? "warning" : "error"}
          title={notFound ? "This item isn't in the current store" : "We couldn't load this product"}
          testId="product-error"
          action={
            notFound ? (
              <Link to="/catalog" className="btn-ghost">
                Browse catalog
              </Link>
            ) : (
              <button className="btn-ghost" onClick={() => res.reload()}>
                Retry
              </button>
            )
          }
        >
          {res.error?.message}
        </Banner>
      </div>
    );
  }

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const unit = variant.price + addOns.filter((a) => selectedAddOns.includes(a.id)).reduce((s, a) => s + a.price, 0);
  const total = unit * qty;
  const canAdd = !!availability?.available;

  function add() {
    addToBasket({ slug: product!.slug, variantId: variant.id, addOnIds: selectedAddOns, qty });
    setAdded(true);
  }

  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-500">
        <Link to="/" className="hover:text-ink">
          Home
        </Link>{" "}
        /{" "}
        <Link to="/catalog" className="hover:text-ink">
          {profile.id === "telecom" ? "Plans" : "Shop"}
        </Link>{" "}
        / <span className="text-ink">{product.name}</span>
      </nav>
      <div className="grid gap-10 lg:grid-cols-2" data-testid="product-detail" data-slug={product.slug}>
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <ProductIllustration slug={product.slug} label={product.name} width={640} height={400} className="w-full" priority />
          </div>
          <div className="card p-6">
            <h2 className="font-semibold">Highlights</h2>
            <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              {product.specs.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <Icon name="check" className="h-4 w-4 text-accent" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-3">
            <span className="text-sm font-medium text-accent">{product.category}</span>
            <Stars rating={product.rating} reviews={product.reviews} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" data-testid="product-name">
            {product.name}
          </h1>
          <p className="mt-3 text-slate-600">{product.description}</p>

          <fieldset className="mt-8">
            <legend className="mb-3 text-sm font-semibold">{profile.id === "telecom" ? "Choose your term" : "Choose your configuration"}</legend>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
              {product.variants.map((v) => (
                <label
                  key={v.id}
                  className={cx("flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-4 transition", v.id === variant.id ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-line bg-white hover:border-slate-300")}
                  data-testid={`variant-${v.id}`}
                >
                  <span>
                    <input type="radio" name="variant" value={v.id} checked={v.id === variant.id} onChange={() => setVariantId(v.id)} className="sr-only" />
                    <span className="block font-semibold">{v.label}</span>
                    {v.note && <span className="text-xs font-medium text-accent">{v.note}</span>}
                  </span>
                  <Price amount={v.price} suffix={profile.priceSuffix} className="font-semibold" />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="mb-3 text-sm font-semibold">Optional add-ons</legend>
            <div className="space-y-3">
              {addOns.map((a) => {
                const on = selectedAddOns.includes(a.id);
                return (
                  <label key={a.id} className={cx("flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition", on ? "border-accent bg-accent-soft" : "border-line bg-white hover:border-slate-300")}>
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-[#4F46E5]"
                      checked={on}
                      data-testid={`addon-${a.id}`}
                      onChange={() => setSelectedAddOns((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))}
                    />
                    <span className="flex-1">
                      <span className="block font-medium">{a.name}</span>
                      <span className="text-sm text-slate-600">{a.description}</span>
                    </span>
                    <span className="text-sm font-semibold">
                      +{money(a.price)}
                      {profile.priceSuffix}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6">
            <AvailabilityChecker onResult={setAvailability} />
          </div>

          <div className="mt-6 card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium" id="qty-label">
                  Quantity
                </span>
                <div className="flex items-center rounded-full border border-line" role="group" aria-labelledby="qty-label">
                  <button className="p-2.5 text-slate-600 hover:text-ink disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity" data-testid="btn-qty-decrease">
                    <Icon name="minus" className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-semibold" data-testid="product-qty" aria-live="polite">
                    {qty}
                  </span>
                  <button className="p-2.5 text-slate-600 hover:text-ink disabled:opacity-40" onClick={() => setQty((q) => Math.min(10, q + 1))} disabled={qty >= 10} aria-label="Increase quantity" data-testid="btn-qty-increase">
                    <Icon name="plus" className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Total{profile.priceSuffix ? " per month" : ""}</p>
                <Price amount={total} suffix={profile.priceSuffix} className="text-2xl font-semibold" />
                <span className="sr-only" data-testid="product-price">
                  {total}
                </span>
              </div>
            </div>
            <button
              className="btn-primary mt-5 h-12 w-full text-base"
              disabled={!canAdd}
              onClick={add}
              data-testid="btn-add-to-basket"
              id="btn-add-to-basket"
              data-state={added ? "success" : canAdd ? "idle" : "disabled"}
            >
              <Icon name="basket" className="h-5 w-5" /> Add to basket
            </button>
            {!canAdd && (
              <p className="mt-2 text-center text-xs text-slate-500" data-testid="add-to-basket-hint">
                {availability && !availability.available ? "Not available at this postcode. Try another." : `Check ${profile.id === "telecom" ? "availability" : "delivery"} for your postcode to continue.`}
              </p>
            )}
            {added && (
              <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 sm:flex-row" role="status" data-testid="added-to-basket">
                <span className="flex items-center gap-2 font-medium">
                  <Icon name="check" className="h-4 w-4" /> Added to your basket
                </span>
                <button className="btn-dark py-2" onClick={() => navigate("/basket")} data-testid="btn-view-basket">
                  View basket & checkout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {recs.data && recs.data.products.length > 0 && (
        <section className="mt-16" aria-labelledby="recs-heading" data-testid="recommendations" data-state={recs.state}>
          <h2 id="recs-heading" className="mb-6 text-2xl font-semibold tracking-tight">
            You might also like
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recs.data.products.map((p) => (
              <ProductCard key={p.slug} product={p} priceSuffix={profile.priceSuffix} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="container-page grid gap-10 py-10 lg:grid-cols-2" data-testid="product-loading" aria-busy="true">
      <div className="skeleton aspect-[8/5] rounded-2xl" />
      <div className="space-y-4">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-10 w-3/4" />
        <div className="skeleton h-20 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
        <div className="skeleton h-32 w-full" />
      </div>
    </div>
  );
}
