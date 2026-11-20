import { vendorOrigin } from "../lib/vendors";

interface Props {
  slug: string;
  label: string;
  width?: number;
  height?: number;
  className?: string;
  /** Above-the-fold images load eagerly; everything else is lazy. */
  priority?: boolean;
}

/** Product image served from the CDN host as an SVG file (rendered by the Worker from ProductArt). */
export function ProductIllustration({ slug, label, width = 320, height = 200, className, priority }: Props) {
  return (
    <img
      src={`${vendorOrigin("cdn")}/img/products/${slug}.svg`}
      width={width}
      height={height}
      alt={label}
      className={className}
      style={{ maxWidth: "100%", height: "auto", display: "block", aspectRatio: "8 / 5" }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      data-testid={`illustration-${slug}`}
    />
  );
}
