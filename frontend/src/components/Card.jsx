import React from "react";

/**
 * Showcase card matching 21st.dev/r/jatin-yadav05/showcase-card-1.
 * CSS handles all styles: bg, blur, border-radius, shadow, hover, entrance anim.
 */
const Card = React.forwardRef(
  ({ children, className = "", variant = "card", style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`${variant} ${className}`}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";
export default Card;
