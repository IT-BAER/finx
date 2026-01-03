import { motion } from "framer-motion";
import { motionTheme, prefersReducedMotion } from "../utils/motionTheme";

/**
 * AnimatedPage - Wrapper component for page-level entrance animations
 * Optimized for fast, responsive UX with subtle movements
 * Uses Material Design 3 inspired timing and easing
 */
export const AnimatedPage = ({ children, className = "", delay = 0 }) => {
  const reducedMotion = prefersReducedMotion();

  const variants = {
    hidden: {
      opacity: 0,
      y: reducedMotion ? 0 : motionTheme.distances.medium,
    },
    visible: {
      opacity: 1,
      y: 0,
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={{
        duration: reducedMotion ? 0 : motionTheme.durations.medium,
        delay: delay,
        ease: motionTheme.easings.emphasizedDecelerate,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * AnimatedSection - For sections that animate on scroll into view or immediately
 * Uses whileInView with optimized viewport settings (or animate for immediate)
 * Fast entrance with subtle movement for professional feel
 * Set scrollTriggered={false} for immediate animation on mount
 */
export const AnimatedSection = ({
  children,
  className = "",
  delay = 0,
  once = true,
  margin = "-50px",
  scrollTriggered = true,
}) => {
  const reducedMotion = prefersReducedMotion();

  const variants = {
    hidden: {
      opacity: 0,
      y: reducedMotion ? 0 : motionTheme.distances.small,
    },
    visible: {
      opacity: 1,
      y: 0,
    },
  };

  // Choose between scroll-triggered or immediate animation
  const animationProps = scrollTriggered
    ? {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once, margin },
      }
    : {
        initial: "hidden",
        animate: "visible",
      };

  return (
    <motion.div
      {...animationProps}
      variants={variants}
      transition={{
        duration: reducedMotion ? 0 : motionTheme.durations.medium,
        delay: delay,
        ease: motionTheme.easings.emphasizedDecelerate,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * AnimatedCard - For cards that animate on scroll with hover effects
 * Combines scroll-triggered entrance with interactive hover/tap animations
 * Optimized for responsive, professional feel
 */
export const AnimatedCard = ({
  children,
  className = "",
  delay = 0,
  once = true,
  interactive = true,
  onClick,
}) => {
  const reducedMotion = prefersReducedMotion();

  const variants = {
    hidden: {
      opacity: 0,
      y: reducedMotion ? 0 : motionTheme.distances.small,
      scale: reducedMotion ? 1 : motionTheme.scales.subtle,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
    },
  };

  // Subtle, professional hover/tap effects
  const interactiveProps = interactive && !reducedMotion
    ? {
        whileHover: { scale: 1.01, y: -2 },
        whileTap: { scale: motionTheme.scales.pressed },
      }
    : {};

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-30px" }}
      variants={variants}
      {...interactiveProps}
      transition={{
        // Entry animation
        duration: reducedMotion ? 0 : motionTheme.durations.medium,
        delay: delay,
        ease: motionTheme.easings.emphasizedDecelerate,
        // Hover/tap uses spring for natural feel
        scale: motionTheme.springs.responsive,
        y: motionTheme.springs.responsive,
      }}
      className={className}
      onClick={onClick}
      style={{ willChange: interactive ? "transform" : "auto" }}
    >
      {children}
    </motion.div>
  );
};

/**
 * AnimatedStagger - Container for staggered children animations
 * Children will animate in sequence with optimized timing
 * Fast stagger for responsive list animations
 */
export const AnimatedStagger = ({
  children,
  className = "",
  staggerDelay = 0.05,
  initialDelay = 0,
}) => {
  const reducedMotion = prefersReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: reducedMotion ? 0 : initialDelay,
        staggerChildren: reducedMotion ? 0 : staggerDelay,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * AnimatedItem - Child of AnimatedStagger for individual items
 * Optimized for fast, subtle entrance animations
 */
export const AnimatedItem = ({ children, className = "" }) => {
  const reducedMotion = prefersReducedMotion();

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: reducedMotion ? 0 : motionTheme.distances.subtle,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reducedMotion ? 0 : motionTheme.durations.base,
        ease: motionTheme.easings.emphasizedDecelerate,
      },
    },
  };

  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
};

/**
 * AnimatedHero - Special animation for hero/header sections
 * Provides staggered animation for headline, subheadline, and CTAs
 * Optimized for fast, impactful entrance
 */
export const AnimatedHero = ({
  headline,
  subheadline,
  children,
  className = "",
}) => {
  const reducedMotion = prefersReducedMotion();

  const baseTransition = {
    duration: reducedMotion ? 0 : motionTheme.durations.medium,
    ease: motionTheme.easings.emphasizedDecelerate,
  };

  const variants = {
    hidden: { opacity: 0, y: reducedMotion ? 0 : motionTheme.distances.medium },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className={className}>
      {headline && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={variants}
          transition={{ ...baseTransition, delay: 0 }}
        >
          {headline}
        </motion.div>
      )}
      {subheadline && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={variants}
          transition={{ ...baseTransition, delay: reducedMotion ? 0 : 0.1 }}
        >
          {subheadline}
        </motion.div>
      )}
      {children && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={variants}
          transition={{ ...baseTransition, delay: reducedMotion ? 0 : 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
};

export default AnimatedPage;
