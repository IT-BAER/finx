import React, { forwardRef } from "react";
import { motion } from "framer-motion";

const Input = forwardRef(
  (
    {
      type = "text",
      id,
      name,
      value,
      onChange,
      onFocus,
      onBlur,
      placeholder,
      required,
      disabled,
      className = "",
      label,
      haptic = "tap",
      floatingLabel = false,
      ...props
    },
    ref,
  ) => {
    const handleFocus = (e) => {
      // Remove haptic feedback - only notifications and "+" button should have haptic
      // Call the original onFocus handler if provided
      if (onFocus) {
        onFocus(e);
      }
    };

    // For floating label inputs (used in Login/Register)
    if (floatingLabel) {
      return (
        <>
          <motion.input
            ref={ref}
            type={type}
            id={id}
            name={name}
            className={`form-input floating-input ${className}`}
            value={value}
            onChange={onChange}
            onFocus={handleFocus}
            onBlur={onBlur}
            placeholder=" "
            required={required}
            disabled={disabled}
            whileFocus={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 250, damping: 20 }}
            {...props}
          />
          <label htmlFor={id} className="floating-label">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        </>
      );
    }

    // For regular inputs with label above
    return (
      <>
        {label && (
          <label htmlFor={id} className="form-label">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <motion.input
          ref={ref}
          type={type}
          id={id}
          name={name}
          className={`form-input ${className}`}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          whileFocus={{ scale: 1.005 }}
          transition={{ type: "spring", stiffness: 250, damping: 20 }}
          {...props}
        />
      </>
    );
  },
);

Input.displayName = "Input";

export default Input;
