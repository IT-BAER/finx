/**
 * Haptic feedback utility for mobile web apps
 * Provides vibration feedback for user interactions
 */

// Check if device is mobile
const isMobile = () => {
  return typeof window !== "undefined" && window.innerWidth <= 768;
};

/**
 * Trigger a haptic feedback vibration
 * @param {number|number[]} pattern - Vibration pattern (single duration or array of durations)
 * @param {boolean} force - Whether to force haptic feedback even on non-mobile devices
 * @returns {boolean} - Whether vibration was triggered successfully
 */
export const triggerHaptic = (pattern = 10, force = false) => {
  // Only trigger haptic feedback on mobile devices or when forced
  if (!force && !isMobile()) {
    return false;
  }

  // Check if vibration API is supported
  if (!("vibrate" in navigator)) {
    console.debug("Vibration API not supported");
    return false;
  }

  // Check if user has reduced motion preference
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    console.debug(
      "Reduced motion preference detected, skipping haptic feedback",
    );
    return false;
  }

  try {
    // Trigger vibration
    navigator.vibrate(pattern);
    return true;
  } catch (error) {
    console.debug("Error triggering haptic feedback:", error);
    return false;
  }
};

/**
 * Trigger a light tap haptic feedback
 * Good for button presses and simple interactions
 * @param {boolean} force - Whether to force haptic feedback even on non-mobile devices
 */
export const hapticTap = (force = false) => {
  triggerHaptic(10, force);
};

/**
 * Trigger a medium impact haptic feedback
 * Good for important interactions like saving data
 * @param {boolean} force - Whether to force haptic feedback even on non-mobile devices
 */
export const hapticImpact = (force = false) => {
  triggerHaptic([10, 30, 10], force);
};

/**
 * Trigger a heavy impact haptic feedback
 * Good for critical actions like deleting data
 * @param {boolean} force - Whether to force haptic feedback even on non-mobile devices
 */
export const hapticHeavyImpact = (force = false) => {
  triggerHaptic([20, 40, 20], force);
};

/**
 * Trigger a selection haptic feedback
 * Good for changing selections or toggling states
 * @param {boolean} force - Whether to force haptic feedback even on non-mobile devices
 */
export const hapticSelection = (force = false) => {
  triggerHaptic(5, force);
};

export default {
  triggerHaptic,
  hapticTap,
  hapticImpact,
  hapticHeavyImpact,
  hapticSelection,
};
