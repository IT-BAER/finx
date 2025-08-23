import React from "react";

// Consolidated framer-motion fallback with JSX syntax
function createFallback(tag) {
  return React.forwardRef(({ children, style, ...rest }, ref) => {
    const Component = tag;
    // Remove framer-motion specific props before passing to DOM
    const motionProps = [
      "animate",
      "initial",
      "exit",
      "variants",
      "whileHover",
      "whileTap",
      "whileFocus",
      "whileInView",
      "transition",
      "drag",
      "onAnimationStart",
      "onAnimationComplete",
      "onUpdate",
      "onAnimationRepeat",
      "layout",
    ];
    for (const p of motionProps) delete rest[p];
    return (
      <Component ref={ref} style={style} {...rest}>
        {children}
      </Component>
    );
  });
}

const baseMotion = {
  div: createFallback("div"),
  span: createFallback("span"),
  button: createFallback("button"),
  section: createFallback("section"),
  header: createFallback("header"),
  footer: createFallback("footer"),
  nav: createFallback("nav"),
  main: createFallback("main"),
  img: createFallback("img"),
};

// Proxy to dynamically provide fallback components
const motionProxy = new Proxy(baseMotion, {
  get(target, prop) {
    if (prop in target) return target[prop];
    const comp = createFallback(String(prop));
    target[prop] = comp;
    return comp;
  },
});

export function loadMotion() {
  return import("framer-motion").then((mod) => mod).catch(() => null);
}

export function AnimatePresence({ children }) {
  return children || null;
}

// Named exports for specific functionality
export { motionProxy as motion, loadMotion, AnimatePresence };

// Default export for backward compatibility
export default { motion: motionProxy, loadMotion, AnimatePresence };
