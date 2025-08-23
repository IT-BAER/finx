import React, { useRef, useEffect, useState } from "react";
import styled from "styled-components";
import { motion } from "framer-motion";
import { motionTheme } from "../utils/motionTheme.js";

const Button = ({
  variant = "primary",
  children,
  icon,
  onClick,
  className,
  type = "button",
  disabled = false,
}) => {
  const textRef = useRef(null);
  const [fontSize, setFontSize] = useState("inherit");

  useEffect(() => {
    const adjustFontSize = () => {
      const element = textRef.current;
      if (!element) return;

      // Reset to default size before checking
      element.style.fontSize = "inherit";

      const container = element.closest(".button-inner");
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const availableWidth = containerRect.width - 20; // Account for padding

      const originalFontSize = parseFloat(
        window.getComputedStyle(element).fontSize
      );

      let currentFontSize = originalFontSize;
      while (element.scrollWidth > availableWidth && currentFontSize > 10) {
        currentFontSize -= 1;
        element.style.fontSize = `${currentFontSize}px`;
      }

      setFontSize(
        currentFontSize !== originalFontSize
          ? `${currentFontSize}px`
          : "inherit"
      );
    };

    adjustFontSize();

    const resizeObserver = new ResizeObserver(adjustFontSize);
    if (textRef.current) {
      const buttonInner = textRef.current.closest(".button-inner");
      if (buttonInner) {
        resizeObserver.observe(buttonInner);
      }
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [children]);

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    }
  };

  // Simplified icon handling
  let renderedIcon = null;
  if (icon) {
    const variantClassMap = {
      primary: "w-6 h-6 icon-tint-accent",
      secondary: "w-6 h-6 icon-tint-strong",
      danger: "w-6 h-6 icon-tint-danger",
    };
    const defaultIconClass = variantClassMap[variant] || "w-6 h-6 icon-tint-accent";

    if (React.isValidElement(icon)) {
      // Merge developer-provided classes with defaults
      const existing = icon.props?.className || "";
      const existingList = existing.split(/\s+/).filter(Boolean);
      const defaultList = defaultIconClass.split(/\s+/).filter(Boolean);

      // Avoid forcing tint filters if already specified
      const hasIconClass = existingList.some((c) =>
        ["icon", "icon-mask", "icon-tint"].includes(c)
      );

      let mergedList;
      if (hasIconClass) {
        // Keep developer classes but ensure size classes are present
        const sizeClasses = defaultList.filter(
          (c) =>
            c.startsWith("w-") ||
            c.startsWith("h-") ||
            ["icon-sm", "icon-md", "icon-lg"].includes(c)
        );
        mergedList = Array.from(new Set([...existingList, ...sizeClasses]));
      } else {
        // Apply full defaults
        mergedList = Array.from(new Set([...defaultList, ...existingList]));
      }

      const finalClass = mergedList.join(" ");
      renderedIcon = React.cloneElement(icon, {
        className: finalClass,
        alt: icon.props?.alt || "",
      });
    } else if (typeof icon === "string") {
      renderedIcon = <img src={icon} alt="" className={defaultIconClass} />;
    } else {
      renderedIcon = icon;
    }
  }

  return (
    <MotionButton
      $variant={variant}
      className={className}
      onClick={handleClick}
      type={type}
      disabled={disabled}
      aria-disabled={disabled}
      whileTap={!disabled ? { scale: 0.96 } : {}}
      transition={motionTheme.springs.press}
    >
      <div className="button-inner">
        {renderedIcon && <div className="button-icon">{renderedIcon}</div>}
        <span
          ref={textRef}
          style={{
            ...(renderedIcon ? { padding: "0 0 0 24px" } : {}),
            fontSize: fontSize,
            whiteSpace: "nowrap",
            display: "inline-block",
          }}
        >
          {children}
        </span>
      </div>
    </MotionButton>
  );
};

const MotionButton = styled(motion.button)`
  min-width: 131px;
  max-width: 180px;
  height: 40px;
  border-radius: 10px;

  @media (max-width: 768px) {
    height: 45px;
  }
  cursor: pointer;
  transition: 0.3s ease;
  border: 1px solid transparent;
  padding: 0;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  ${({ $variant }) =>
    $variant === "primary" &&
    `
    background: linear-gradient(
      to bottom right,
      var(--accent) 0%,
      rgba(46, 142, 255, 0) 30%
    );
    background-color: color-mix(in srgb, var(--accent) 20%, transparent);
    color: var(--text);

    &:hover,
    &:focus {
      background-color: color-mix(in srgb, var(--accent) 70%, transparent);
      box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 50%, transparent);
      outline: none;
    }
    
    @media (max-width: 768px) {
      &:hover {
        background-color: color-mix(in srgb, var(--accent) 20%, transparent);
        box-shadow: none;
      }
    }
  `}

  ${({ $variant }) =>
    $variant === "secondary" &&
    `
    background: linear-gradient(
      to bottom right,
      var(--muted) 0%,
      rgba(108, 117, 125, 0) 30%
    );
    background-color: color-mix(in srgb, var(--muted) 20%, transparent);
    color: var(--text);

    &:hover,
    &:focus {
      background-color: color-mix(in srgb, var(--muted) 70%, transparent);
      box-shadow: 0 0 10px color-mix(in srgb, var(--muted) 50%, transparent);
      outline: none;
    }
    
    @media (max-width: 768px) {
      &:hover {
        background-color: color-mix(in srgb, var(--muted) 20%, transparent);
        box-shadow: none;
      }
    }
  `}

  ${({ $variant }) =>
    $variant === "danger" &&
    `
    background: linear-gradient(
      to bottom right,
      var(--danger) 0%,
      rgba(220, 53, 69, 0) 30%
    );
    background-color: color-mix(in srgb, var(--danger) 20%, transparent);
    color: var(--text);

    &:hover,
    &:focus {
      background-color: color-mix(in srgb, var(--danger) 70%, transparent);
      box-shadow: 0 0 10px color-mix(in srgb, var(--danger) 50%, transparent);
      outline: none;
    }
    
    @media (max-width: 768px) {
      &:hover {
        background-color: color-mix(in srgb, var(--danger) 20%, transparent);
        box-shadow: none;
      }
    }
  `}

  .button-inner {
    width: calc(100% - 2px);
    height: calc(100% - 2px);
    border-radius: 8px;
    background-color: var(--button-inner-bg, #1a1a1a);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    position: relative;
    transition: background-color 0.2s ease;
  }

  .button-icon {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    position: absolute;
    left: 10px;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    &:active .button-inner {
      background-color: color-mix(
        in srgb,
        var(--text) 20%,
        var(--button-inner-bg, #1a1a1a)
      );
    }
  }
`;

export default Button;
