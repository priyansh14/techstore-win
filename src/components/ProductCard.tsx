import { Link } from "react-router-dom";
import type { Product } from "../../shared/types";
import { ProductIllustration } from "./ProductIllustration";
import { Icon, Price, Stars } from "./ui";

export function ProductCard({ product, priceSuffix }: { product: Product; priceSuffix: string }) {
  const from = Math.min(...product.variants.map((v) => v.price));
  return (
    <article className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/5" data-testid={`product-card-${product.slug}`}>
      <Link to={`/product/${product.slug}`} className="relative block border-b border-line" tabIndex={-1} aria-hidden="true">
        <ProductIllustration slug={product.slug} label={product.name} className="w-full" />
        {product.badge && (
          <span className="absolute top-3 left-3 rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white">{product.badge}</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-accent">{product.category}</span>
          <Stars rating={product.rating} reviews={product.reviews} />
        </div>
        <h3 className="text-lg font-semibold tracking-tight">
          <Link to={`/product/${product.slug}`} className="hover:text-accent" data-testid={`product-link-${product.slug}`}>
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-slate-600">{product.tagline}</p>
        <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
          {product.specs.slice(0, 3).map((s) => (
            <li key={s} className="flex items-center gap-2">
              <Icon name="check" className="h-4 w-4 shrink-0 text-accent" />
              {s}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <p className="text-xs text-slate-500">From</p>
            <Price amount={from} suffix={priceSuffix} className="text-xl font-semibold" />
          </div>
          <Link to={`/product/${product.slug}`} className="btn-ghost" data-testid={`btn-configure-${product.slug}`}>
            Configure <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-[8/5] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton h-16 w-full" />
      </div>
    </div>
  );
}
