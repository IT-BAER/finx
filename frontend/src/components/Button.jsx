import React from "react";
import { motion } from "framer-motion";
import { motionTheme } from "../utils/motionTheme.js";

/* ─── Variant-specific CSS-variable overrides ─────────────────────── */
const VARIANT_VARS = {
  primary: {
    "--neon": "var(--accent)",
    "--neon-bg": "color-mix(in srgb, var(--accent) 5%, transparent)",
    "--neon-border": "color-mix(in srgb, var(--accent) 20%, transparent)",
  },
  secondary: {
    "--neon": "var(--muted)",
    "--neon-bg": "transparent",
    "--neon-border": "transparent",
  },
  danger: {
    "--neon": "var(--danger)",
    "--neon-bg": "color-mix(in srgb, var(--danger) 5%, transparent)",
    "--neon-border": "color-mix(in srgb, var(--danger) 20%, transparent)",
  },
};

const Button = React.forwardRef(
  (
    {
      variant = "primary",
      children,
      icon,
      onClick,
      className,
      type = "button",
      disabled = false,
    },
    ref
  ) => {
    const vars = VARIANT_VARS[variant] || VARIANT_VARS.primary;

    /* ── Icon handling ─────────────────────────────────────────────── */
    let renderedIcon = null;
    if (icon) {
      const variantIconClass = {
        primary: "w-5 h-5 icon-tint-accent",
        secondary: "w-5 h-5 icon-tint-strong",
        danger: "w-5 h-5 icon-tint-danger",
      }[variant] || "w-5 h-5 icon-tint-accent";

      if (React.isValidElement(icon)) {
        const existing = icon.props?.className || "";
        const hasCustom = existing.split(/\s+/).some((c) => c.startsWith("icon"));
        const finalClass = hasCustom ? existing : `${variantIconClass} ${existing}`.trim();
        renderedIcon = React.cloneElement(icon, {
          className: finalClass,
          alt: icon.props?.alt || "",
        });
      } else if (typeof icon === "string") {
        renderedIcon = <img src={icon} alt="" className={variantIconClass} />;
      } else {
        renderedIcon = icon;
      }
    }

    return (
      <motion.button
        ref={ref}
        className={`neon-btn neon-btn-${variant} ${className || ""}`}
        onClick={onClick}
        type={type}
        disabled={disabled}
        aria-disabled={disabled}
        whileTap={!disabled ? { scale: 0.96 } : {}}
        transition={motionTheme.springs.press}
        style={vars}
      >
        {/* Top neon glow line */}
        <span className="neon-btn-glow neon-btn-glow-top" aria-hidden="true" />
        {/* Content */}
        <span className="neon-btn-content">
          {renderedIcon}
          <span className="neon-btn-label">{children}</span>
        </span>
        {/* Bottom neon glow line */}
        <span className="neon-btn-glow neon-btn-glow-bottom" aria-hidden="true" />
      </motion.button>
    );
  }
);

Button.displayName = "Button";
export default Button;
