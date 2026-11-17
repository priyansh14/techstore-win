import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { priceBasket, TEST_CARDS } from "../../shared/engine";
import type { CheckoutInput, OrderView } from "../../shared/types";
import { Banner, Icon, PageHeader, Spinner } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { cx, money } from "../lib/format";
import { rum } from "../lib/rumBridge";
import { useApp, useConfig } from "../state/AppContext";
import { getPromo } from "./Basket";

interface Form {
  fullName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  slot: string;
  preference: string;
  taxInvoice: boolean;
  taxId: string;
  cardName: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}

const EMPTY: Form = { fullName: "", email: "", phone: "", line1: "", line2: "", city: "", postcode: "", slot: "", preference: "", taxInvoice: false, taxId: "", cardName: "", cardNumber: "", expiry: "", cvc: "" };

type SubmitState = "idle" | "loading" | "success" | "error";

export default function Checkout() {
  const { profile } = useConfig();
  const { basket, clearBasket, rememberOrder } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>({ ...EMPTY, slot: profile.journey.slotOptions[0].value, preference: profile.journey.preferenceOptions[0].value });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<SubmitState>("idle");
  const [failure, setFailure] = useState<{ code: string; message: string; status: number }>();
  const promo = getPromo();
  const { lines, totals } = priceBasket(profile, basket, promo);

  if (basket.length === 0 && state !== "success") return <Navigate to="/basket" replace />;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  function fillDemo() {
    setForm({
      fullName: "Ava Chen",
      email: "ava.chen@example.com",
      phone: "+1 415 555 0142",
      line1: "88 Market Street",
      line2: "Suite 400",
      city: "San Francisco",
      postcode: "94105",
      slot: profile.journey.slotOptions[0].value,
      preference: profile.journey.preferenceOptions[0].value,
      taxInvoice: false,
      taxId: "",
      cardName: "Ava Chen",
      cardNumber: "4242 4242 4242 4242",
      expiry: "12/29",
      cvc: "123",
    });
    setErrors({});
    rum.tracepoint("checkoutstep", "prefill");
  }

  function clientValidate(): Record<string, string> {
    const e: Record<string, string> = {};
    const digits = form.cardNumber.replace(/\D/g, "");
    if (!digits) e.cardNumber = "Enter the demo card number";
    else if (!TEST_CARDS[digits]) e.cardNumber = "This demo store only accepts test cards, e.g. 4242 4242 4242 4242";
    if (!/^\d{3,4}$/.test(form.cvc)) e.cvc = "Enter a 3–4 digit CVC";
    return e;
  }

  async function submit(ev?: FormEvent) {
    ev?.preventDefault();
    const local = clientValidate();
    const digits = form.cardNumber.replace(/\D/g, "");
    const input: CheckoutInput = {
      items: basket,
      promoCode: promo,
      customer: { fullName: form.fullName, email: form.email, phone: form.phone },
      address: { line1: form.line1, line2: form.line2 || undefined, city: form.city, postcode: form.postcode },
      journey: { slot: form.slot, preference: form.preference, taxInvoice: form.taxInvoice || undefined, taxId: form.taxInvoice ? form.taxId : undefined },
      // Only non-sensitive card metadata ever leaves the browser.
      payment: { cardName: form.cardName, last4: digits.slice(-4), expiry: form.expiry.trim(), brand: TEST_CARDS[digits] ?? "Card" },
    };
    if (Object.keys(local).length) {
      setErrors(local);
      setState("error");
      setFailure({ code: "VALIDATION_FAILED", message: "Please correct the highlighted fields.", status: 0 });
      return;
    }
    setState("loading");
    setFailure(undefined);
    setErrors({});
    rum.mark("checkout:submit");
    rum.tracepoint("checkoutstep", "submit");
    const submitStarted = performance.now();
    try {
      const { order } = await api<{ order: OrderView }>("/api/orders", { method: "POST", body: input });
      rum.mark("checkout:success");
      rum.measure("checkout-submit", "checkout:submit", "checkout:success");
      rum.indicator("checkoutms", performance.now() - submitStarted);
      rum.tracepoint("checkoutstep", "success");
      rum.tracepoint("orderid", order.id);
      rum.conversion(order.totals.total, order.lines.reduce((n, l) => n + l.qty, 0));
      setState("success");
      rememberOrder(order.id);
      clearBasket();
      try {
        sessionStorage.removeItem("nexora:promo");
      } catch {
        /* ignore */
      }
      navigate(`/orders/${order.id}?placed=1`);
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError(0, "UNKNOWN", "Something went wrong placing your order.");
      rum.indicator("checkoutms", performance.now() - submitStarted);
      rum.tracepoint("checkoutstep", "failed");
      rum.tracepoint("paymenterror", `${e.status} ${e.code}`);
      setErrors(e.fields ?? {});
      setFailure({ code: e.code, message: e.message, status: e.status });
      setState("error");
    }
  }

  const field = (k: keyof Form) => ({
    id: `checkout-${k}`,
    value: form[k] as string,
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `checkout-${k}-error` : undefined,
    className: "input",
  });

  return (
    <div className="container-page py-12">
      <PageHeader title="Checkout">
        <span className="inline-flex items-center gap-2 text-sm">
          <Icon name="shield" className="h-4 w-4 text-accent" /> Demo checkout. Use the test card 4242 4242 4242 4242. Never enter real card details.
        </span>
      </PageHeader>

      {state === "error" && failure && (
        <div className="mb-8" data-testid="checkout-error" data-code={failure.code} data-status={failure.status}>
          {failure.code === "VALIDATION_FAILED" ? (
            <Banner tone="error" title="Some details need attention">
              {failure.message}
            </Banner>
          ) : (
            <Banner
              tone="error"
              title={failure.code === "PAYMENT_GATEWAY_TIMEOUT" ? "We couldn't confirm your payment" : "Your order couldn't be placed"}
              action={
                <button className="btn-dark shrink-0" onClick={() => submit()} data-testid="btn-retry-order">
                  Try again
                </button>
              }
            >
              <p>{failure.message}.</p>
              <p className="mt-1 font-mono text-xs opacity-75">
                {failure.status ? `HTTP ${failure.status} · ` : ""}
                {failure.code}. You have not been charged. Please try again in a moment.
              </p>
            </Banner>
          )}
        </div>
      )}

      <form className="grid gap-8 lg:grid-cols-[1fr_380px]" onSubmit={submit} noValidate data-testid="checkout-form" data-state={state}>
        <div className="space-y-6">
          <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-dashed border-indigo-300 bg-accent-soft p-4 sm:flex-row sm:items-center">
            <p className="text-sm text-indigo-900">In a hurry? Fill every field with a valid demo customer.</p>
            <button type="button" className="btn-ghost shrink-0" onClick={fillDemo} data-testid="btn-fill-demo-customer" id="btn-fill-demo-customer">
              Fill Demo Customer
            </button>
          </div>

          <Section n={1} title="Contact details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" k="fullName" errors={errors} wide>
                <input {...field("fullName")} autoComplete="name" data-testid="input-fullname" />
              </Field>
              <Field label="Email" k="email" errors={errors}>
                <input {...field("email")} type="email" autoComplete="email" data-testid="input-email" />
              </Field>
              <Field label="Phone" k="phone" errors={errors}>
                <input {...field("phone")} type="tel" autoComplete="tel" data-testid="input-phone" />
              </Field>
            </div>
          </Section>

          <Section n={2} title={profile.journey.addressLabel}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address line 1" k="line1" errors={errors} wide>
                <input {...field("line1")} autoComplete="address-line1" data-testid="input-line1" />
              </Field>
              <Field label="Address line 2 (optional)" k="line2" errors={errors} wide>
                <input {...field("line2")} autoComplete="address-line2" data-testid="input-line2" />
              </Field>
              <Field label="City" k="city" errors={errors}>
                <input {...field("city")} autoComplete="address-level2" data-testid="input-city" />
              </Field>
              <Field label="Postcode / PIN" k="postcode" errors={errors}>
                <input {...field("postcode")} autoComplete="postal-code" data-testid="input-checkout-postcode" />
              </Field>
            </div>
          </Section>

          <Section n={3} title={profile.journey.slotLabel}>
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={profile.journey.slotLabel} data-testid="slot-options">
              {profile.journey.slotOptions.map((o) => (
                <label
                  key={o.value}
                  className={cx("cursor-pointer rounded-2xl border p-4 transition", form.slot === o.value ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-line hover:border-slate-300")}
                  data-testid={`slot-${o.value}`}
                >
                  <input type="radio" name="slot" className="sr-only" value={o.value} checked={form.slot === o.value} onChange={() => set("slot", o.value)} />
                  <span className="block text-sm font-semibold">{o.label}</span>
                  {o.note && <span className="text-xs text-slate-500">{o.note}</span>}
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={profile.journey.preferenceLabel} k="preference" errors={errors}>
                <select {...field("preference")} data-testid="select-preference">
                  {profile.journey.preferenceOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {profile.journey.showTaxInvoice && (
              <div className="mt-4 space-y-3" data-testid="tax-invoice-section">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" className="h-4 w-4 accent-[#4F46E5]" checked={form.taxInvoice} onChange={(e) => set("taxInvoice", e.target.checked)} data-testid="toggle-tax-invoice" />
                  I need a GST / tax invoice
                </label>
                {form.taxInvoice && (
                  <Field label="GSTIN / VAT number" k="taxId" errors={errors}>
                    <input {...field("taxId")} data-testid="input-tax-id" placeholder="e.g. 29ABCDE1234F1Z5" />
                  </Field>
                )}
              </div>
            )}
          </Section>

          <Section n={4} title="Payment">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name on card" k="cardName" errors={errors} wide>
                <input {...field("cardName")} autoComplete="off" data-testid="input-card-name" />
              </Field>
              <Field label="Card number (test cards only)" k="cardNumber" errors={errors} wide>
                <input {...field("cardNumber")} inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" data-testid="input-card-number" />
              </Field>
              <Field label="Expiry (MM/YY)" k="expiry" errors={errors}>
                <input {...field("expiry")} inputMode="numeric" autoComplete="off" placeholder="12/29" data-testid="input-card-expiry" />
              </Field>
              <Field label="CVC" k="cvc" errors={errors}>
                <input {...field("cvc")} inputMode="numeric" autoComplete="off" placeholder="123" data-testid="input-card-cvc" />
              </Field>
            </div>
          </Section>
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-24" aria-label="Order summary">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <ul className="mt-4 divide-y divide-line text-sm">
            {lines.map((l) => (
              <li key={`${l.slug}-${l.variantId}-${l.addOnIds.join()}`} className="flex justify-between gap-3 py-3">
                <span>
                  <span className="font-medium">
                    {l.qty} × {l.name}
                  </span>
                  <span className="block text-xs text-slate-500">{[l.variantLabel, ...l.addOnNames].join(" · ")}</span>
                </span>
                <span className="shrink-0">{money(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Subtotal</dt>
              <dd>{money(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Discount ({promo})</dt>
                <dd>−{money(totals.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-600">Tax</dt>
              <dd>{money(totals.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd data-testid="checkout-total">{money(totals.total)}</dd>
            </div>
          </dl>
          <button type="submit" className="btn-primary mt-6 h-12 w-full text-base" disabled={state === "loading"} data-testid="btn-place-order" id="btn-place-order" data-state={state}>
            {state === "loading" ? (
              <>
                <Spinner /> Authorizing payment…
              </>
            ) : (
              <>Place order · {money(totals.total)}</>
            )}
          </button>
          <Link to="/basket" className="mt-3 block text-center text-sm text-slate-600 hover:text-ink">
            Back to basket
          </Link>
        </aside>
      </form>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="card p-6" aria-labelledby={`section-${n}`}>
      <h2 id={`section-${n}`} className="mb-5 flex items-center gap-3 text-lg font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, k, errors, wide, children }: { label: string; k: string; errors: Record<string, string>; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={`checkout-${k}`} className="label">
        {label}
      </label>
      {children}
      {errors[k] && (
        <p id={`checkout-${k}-error`} className="mt-1 text-sm text-rose-600" data-testid={`error-${k}`}>
          {errors[k]}
        </p>
      )}
    </div>
  );
}
