import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { priceBasket, PROMO_CODES } from "../../shared/engine";
import { ProductIllustration } from "../components/ProductIllustration";
import { Icon, PageHeader, Price } from "../components/ui";
import { money } from "../lib/format";
import { useApp, useConfig } from "../state/AppContext";

const PROMO_KEY = "nexora:promo";
export const getPromo = () => {
  try {
    return sessionStorage.getItem(PROMO_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};
const savePromo = (code: string | null) => {
  try {
    if (code) sessionStorage.setItem(PROMO_KEY, code);
    else sessionStorage.removeItem(PROMO_KEY);
  } catch {
    /* ignore */
  }
};

interface PromoRules {
  rules: { percent: number };
}

export default function Basket() {
  const { profile } = useConfig();
  const { basket, setQty, removeLine } = useApp();
  const navigate = useNavigate();
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState(getPromo());
  const [promoMsg, setPromoMsg] = useState<{ tone: "ok" | "err"; text: string }>();
  const { lines, totals } = priceBasket(profile, basket, promo);

  function applyPromo(e: FormEvent) {
    e.preventDefault();
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    if (code === "BROKEN50") {
      // Intentional defect for demos: an uncaught TypeError from a malformed promo payload,
      // so client-side error capture and session replay have something real to show.
      const campaign = (window as unknown as { __nexoraPromos?: Record<string, PromoRules> }).__nexoraPromos?.[code] as PromoRules;
      const pct = campaign.rules.percent;
      setPromoMsg({ tone: "ok", text: `${pct}% off applied` });
      return;
    }
    if (PROMO_CODES[code]) {
      setPromo(code);
      savePromo(code);
      setPromoMsg({ tone: "ok", text: `${code} applied: ${Math.round(PROMO_CODES[code] * 100)}% off your order.` });
    } else {
      setPromoMsg({ tone: "err", text: `"${code}" isn't a valid promo code.` });
    }
  }

  if (basket.length === 0) {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-lg p-10 text-center" data-testid="basket-empty">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Icon name="basket" className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold">Your basket is empty</h1>
          <p className="mt-2 text-slate-600">{profile.id === "telecom" ? "Find the right fiber plan for your home or business." : "Discover our latest devices."}</p>
          <Link to="/catalog" className="btn-primary mt-6" data-testid="btn-browse-empty">
            Browse {profile.id === "telecom" ? "plans" : "devices"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-12">
      <PageHeader title="Your basket" />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="space-y-4" data-testid="basket-lines">
          {lines.map((l, i) => (
            <li key={`${l.slug}-${l.variantId}-${l.addOnIds.join()}`} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center" data-testid={`basket-line-${i}`} data-slug={l.slug}>
              <Link to={`/product/${l.slug}`} className="w-full shrink-0 overflow-hidden rounded-xl border border-line sm:w-40">
                <ProductIllustration slug={l.slug} label={l.name} width={160} height={100} className="w-full" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.name}</p>
                <p className="text-sm text-slate-600">{l.variantLabel}</p>
                {l.addOnNames.map((a) => (
                  <p key={a} className="text-xs text-slate-500">
                    + {a}
                  </p>
                ))}
                <p className="mt-1 text-sm text-slate-500">
                  {money(l.unitPrice)}
                  {profile.priceSuffix} each
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <div className="flex items-center rounded-full border border-line">
                  <button className="p-2 text-slate-600 hover:text-ink disabled:opacity-40" onClick={() => setQty(i, l.qty - 1)} disabled={l.qty <= 1} aria-label={`Decrease quantity of ${l.name}`} data-testid={`btn-decrease-${i}`}>
                    <Icon name="minus" className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-semibold" data-testid={`qty-${i}`}>
                    {l.qty}
                  </span>
                  <button className="p-2 text-slate-600 hover:text-ink disabled:opacity-40" onClick={() => setQty(i, l.qty + 1)} disabled={l.qty >= 10} aria-label={`Increase quantity of ${l.name}`} data-testid={`btn-increase-${i}`}>
                    <Icon name="plus" className="h-4 w-4" />
                  </button>
                </div>
                <Price amount={l.lineTotal} suffix={profile.priceSuffix} className="font-semibold" />
                <button className="flex items-center gap-1 text-sm text-slate-500 hover:text-rose-600" onClick={() => removeLine(i)} data-testid={`btn-remove-${i}`}>
                  <Icon name="trash" className="h-4 w-4" /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        <aside className="card h-fit p-6 lg:sticky lg:top-24" aria-label="Order summary">
          <h2 className="text-lg font-semibold">Summary</h2>
          <form onSubmit={applyPromo} className="mt-4 flex gap-2">
            <label htmlFor="promo" className="sr-only">
              Promo code
            </label>
            <input id="promo" className="input uppercase" placeholder="Promo code" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} data-testid="input-promo" />
            <button className="btn-ghost shrink-0" data-testid="btn-apply-promo">
              Apply
            </button>
          </form>
          {promoMsg && (
            <p className={`mt-2 text-sm ${promoMsg.tone === "ok" ? "text-emerald-700" : "text-rose-600"}`} data-testid="promo-message" role="status">
              {promoMsg.text}
            </p>
          )}
          <dl className="mt-6 space-y-2 text-sm" data-testid="basket-totals">
            <div className="flex justify-between">
              <dt className="text-slate-600">Subtotal</dt>
              <dd data-testid="basket-subtotal">{money(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Discount ({promo})</dt>
                <dd data-testid="basket-discount">−{money(totals.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-600">Tax ({Math.round(profile.taxRate * 100)}%)</dt>
              <dd>{money(totals.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
              <dt>{profile.id === "telecom" ? "First month total" : "Total"}</dt>
              <dd data-testid="basket-total">{money(totals.total)}</dd>
            </div>
          </dl>
          <button className="btn-primary mt-6 h-12 w-full text-base" onClick={() => navigate("/checkout")} data-testid="btn-proceed-checkout" id="btn-proceed-checkout">
            Proceed to checkout <Icon name="arrow" className="h-4 w-4" />
          </button>
          <Link to="/catalog" className="mt-3 block text-center text-sm text-slate-600 hover:text-ink">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
