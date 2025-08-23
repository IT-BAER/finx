import React from "react";

/**
 * Icon component that colors monochrome SVGs at runtime using CSS mask.
 *
 * Props:
 * - src: string (required) - path/URL to the SVG asset
 * - size: 'md'|'lg'|'sm' (optional) - maps to .icon-md/.icon-lg/.icon-sm
 * - variant: 'accent'|'strong'|'danger'|'default' (optional) - controls background color via CSS vars
 * - className: additional class names
 * - alt: accessible text (optional) - if provided, role becomes img and aria-hidden is false
 * - style: extra inline style
 *
 * Notes:
 * - Uses mask-image / -webkit-mask-image to render the SVG as a silhouette that is filled by background-color.
 * - Falls back gracefully: if the SVG is multi-colored the silhouette will be a single color (for logos keep using <img>).
 */

const sizeClassMap = {
  sm: "icon-sm",
  md: "icon-md",
  lg: "icon-lg",
};

const variantClassMap = {
  accent: "variant-accent",
  strong: "variant-strong",
  danger: "variant-danger",
  default: "variant-default",
};

export default function Icon({
  src,
  size = "md",
  variant = "accent",
  className = "",
  alt = "",
  style = {},
  ...props
}) {
  const sizeClass = sizeClassMap[size] || sizeClassMap.md;
  const variantClass = variantClassMap[variant] || variantClassMap.accent;

  // Inline styles for mask and fallback background sizing
  const inline = {
    WebkitMaskImage: `url("${src}")`,
    maskImage: `url("${src}")`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    backgroundSize: "contain",
    ...style,
  };

  // If alt provided, expose as image for accessibility; otherwise aria-hidden
  const ariaHidden = alt ? undefined : true;
  const role = alt ? "img" : undefined;

  return (
    <span
      className={`icon-mask ${sizeClass} ${variantClass} ${className}`.trim()}
      style={inline}
      role={role}
      aria-hidden={ariaHidden}
      aria-label={alt || undefined}
      {...props}
    />
  );
}
