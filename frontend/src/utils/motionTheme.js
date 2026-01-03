// Motion design tokens for consistent animations across the app
// Based on Material Design 3 motion guidelines and modern UX best practices
export const motionTheme = {
  // Duration tokens (in seconds) - Material Design 3 inspired
  // Short: 50-200ms for small utility transitions
  // Medium: 250-400ms for medium area transitions
  // Long: 450-600ms for large expressive transitions
  durations: {
    instant: 0.05, // 50ms - immediate feedback
    fast: 0.1, // 100ms - small utility transitions
    base: 0.15, // 150ms - standard transitions
    medium: 0.25, // 250ms - medium area transitions
    slow: 0.35, // 350ms - larger movements
    page: 0.4, // 400ms - page transitions (reduced from 0.5s)
  },

  // Easing functions - Material Design 3 inspired
  // Standard: For simple, small, or utility-focused transitions
  // Emphasized: For expressive, larger transitions
  easings: {
    // Standard easing set - for utility transitions
    standard: [0.2, 0, 0, 1], // cubic-bezier(0.2, 0, 0, 1)
    standardDecelerate: [0, 0, 0, 1], // cubic-bezier(0, 0, 0, 1) - entering elements
    standardAccelerate: [0.3, 0, 1, 1], // cubic-bezier(0.3, 0, 1, 1) - exiting elements

    // Emphasized easing set - for expressive transitions
    emphasized: [0.2, 0, 0, 1], // Fallback for CSS (Material uses path interpolator)
    emphasizedDecelerate: [0.05, 0.7, 0.1, 1], // cubic-bezier(0.05, 0.7, 0.1, 1)
    emphasizedAccelerate: [0.3, 0, 0.8, 0.15], // cubic-bezier(0.3, 0, 0.8, 0.15)

    // Legacy aliases
    out: [0.05, 0.7, 0.1, 1], // Use emphasizedDecelerate for entering
    inOut: [0.4, 0, 0.2, 1],
    swift: [0.25, 0.1, 0.25, 1],
  },

  // Spring configurations - physics-based for natural feel
  springs: {
    // Snappy spring for immediate feedback (buttons, toggles)
    snappy: {
      type: "spring",
      stiffness: 500,
      damping: 30,
      mass: 1,
    },

    // Responsive spring for interactive elements
    responsive: {
      type: "spring",
      stiffness: 400,
      damping: 28,
      mass: 0.8,
    },

    // Smooth spring for UI transitions
    smooth: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      mass: 1,
    },

    // Gentle spring for larger movements
    gentle: {
      type: "spring",
      stiffness: 200,
      damping: 25,
      mass: 1,
    },

    // Bouncy spring for playful elements (use sparingly)
    bouncy: {
      type: "spring",
      stiffness: 300,
      damping: 20,
      mass: 0.8,
    },

    // Legacy aliases
    stiff: {
      type: "spring",
      stiffness: 400,
      damping: 30,
    },
    medium: {
      type: "spring",
      stiffness: 300,
      damping: 28,
    },
    press: {
      type: "spring",
      stiffness: 500,
      damping: 35,
    },
    hover: {
      type: "spring",
      stiffness: 350,
      damping: 26,
    },
  },

  // Movement distances - keep subtle for professional feel
  distances: {
    subtle: 8, // 8px - for micro-interactions
    small: 12, // 12px - for small elements
    medium: 16, // 16px - for standard transitions
    large: 24, // 24px - for page-level animations
  },

  // Scale values - keep subtle to avoid jarring effects
  scales: {
    pressed: 0.97, // Pressed state
    hover: 1.02, // Hover state
    subtle: 0.99, // Subtle scale for cards
  },

  // Common animation variants - optimized for smooth UX
  variants: {
    // Fade in animations
    fadeIn: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      exit: { opacity: 0 },
    },

    // Scale in animations - subtle scale for professional feel
    scaleIn: {
      hidden: { opacity: 0, scale: 0.98 },
      visible: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.98 },
    },

    // Slide up - for page/section entrances
    slideUp: {
      hidden: { opacity: 0, y: 16 },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -8 },
    },

    // Slide up subtle - for cards and smaller elements
    slideUpSubtle: {
      hidden: { opacity: 0, y: 8 },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -4 },
    },

    // Slide in from right
    slideLeft: {
      hidden: { opacity: 0, x: 16 },
      visible: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -8 },
    },

    // Card entrance - combines fade, scale, and subtle movement
    cardEnter: {
      hidden: { opacity: 0, y: 12, scale: 0.99 },
      visible: { opacity: 1, y: 0, scale: 1 },
    },

    // Legacy aliases
    enter: { opacity: 1, y: 0, scale: 1 },
  },

  // Interaction presets - optimized for responsiveness
  interactions: {
    // Standard pressable (buttons, clickable elements)
    pressable: {
      whileTap: { scale: 0.97 },
      transition: { type: "spring", stiffness: 500, damping: 30 },
    },

    // Strong pressable (primary CTAs, FABs)
    pressableStrong: {
      whileTap: { scale: 0.95 },
      transition: { type: "spring", stiffness: 600, damping: 35 },
    },

    // Card hover - subtle lift effect
    cardHover: {
      whileHover: { scale: 1.01, y: -2 },
      whileTap: { scale: 0.99 },
      transition: { type: "spring", stiffness: 400, damping: 28 },
    },

    // Subtle hover (navigation, links)
    hoverableSubtle: {
      whileHover: { scale: 1.02 },
      transition: { type: "spring", stiffness: 350, damping: 26 },
    },

    // Legacy aliases
    hoverable: {
      whileHover: { scale: 1.02 },
      transition: { type: "spring", stiffness: 350, damping: 28 },
    },
  },

  // Stagger configurations for list animations
  stagger: {
    fast: 0.03, // 30ms between items
    default: 0.05, // 50ms between items
    slow: 0.08, // 80ms between items
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
