// Motion design tokens for consistent animations across the app
export const motionTheme = {
  // Duration tokens (in seconds)
  durations: {
    fast: 0.08, // 80ms - for immediate feedback like button presses
    base: 0.15, // 150ms - for standard transitions
    slow: 0.24, // 240ms - for larger movements or emphasis
    page: 0.3, // 300ms - for page transitions
  },

  // Easing functions
  easings: {
    out: [0.2, 0.8, 0.2, 1], // Ease out for natural slowdown
    inOut: [0.4, 0, 0.2, 1], // Standard ease in out
    swift: [0.25, 0.1, 0.25, 1], // Faster easing for snappy UI
  },

  // Spring configurations
  springs: {
    // Stiff spring for immediate feedback (buttons, cards)
    stiff: {
      type: "spring",
      stiffness: 400,
      damping: 30,
    },

    // Medium spring for UI elements
    medium: {
      type: "spring",
      stiffness: 250,
      damping: 30,
    },

    // Gentle spring for larger movements
    gentle: {
      type: "spring",
      stiffness: 180,
      damping: 24,
    },

    // Button press feedback - optimized for responsiveness
    press: {
      type: "spring",
      stiffness: 500,
      damping: 35,
    },

    // Hover effects - subtle and smooth
    hover: {
      type: "spring",
      stiffness: 300,
      damping: 28,
    },
  },

  // Common animation variants
  variants: {
    // Fade in animations
    fadeIn: {
      hidden: { opacity: 0 },
      enter: { opacity: 1 },
    },

    // Scale in animations
    scaleIn: {
      hidden: { opacity: 0, scale: 0.95 },
      enter: { opacity: 1, scale: 1 },
    },

    // Slide in from bottom
    slideUp: {
      hidden: { opacity: 0, y: 20 },
      enter: { opacity: 1, y: 0 },
    },

    // Slide in from right
    slideLeft: {
      hidden: { opacity: 0, x: 20 },
      enter: { opacity: 1, x: 0 },
    },
  },

  // Interaction presets
  interactions: {
    // Pressable elements (buttons, cards)
    pressable: {
      whileTap: { scale: 0.96 },
      transition: { type: "spring", stiffness: 400, damping: 30 },
    },

    // Strong pressable elements (FAB, primary buttons)
    pressableStrong: {
      whileTap: { scale: 0.94 },
      transition: { type: "spring", stiffness: 500, damping: 35 },
    },

    // Hoverable elements (desktop only)
    hoverable: {
      whileHover: { scale: 1.03 },
      transition: { type: "spring", stiffness: 300, damping: 28 },
    },

    // Subtle hoverable elements
    hoverableSubtle: {
      whileHover: { scale: 1.02 },
      transition: { type: "spring", stiffness: 220, damping: 24 },
    },
  },
};

// Utility function to check for reduced motion preference
export const prefersReducedMotion = () => {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
};

// Utility function to apply reduced motion
export const withReducedMotion = (variants) => {
  if (prefersReducedMotion()) {
    return {
      ...variants,
      transition: { duration: 0 },
    };
  }
  return variants;
};

export default motionTheme;
