import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

const DropdownWithInput = ({
  options = [],
  value = "",
  onChange,
  onCreate,
  placeholder = "",
  label = "",
  required = false,
  id = "",
  name = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const isInternalUpdateRef = useRef(false);
  const portalRootRef = useRef(null);

  // Update filtered options when options or input value changes
  useEffect(() => {
    if (showAllOptions) {
      // Show all options when dropdown is first opened
      setFilteredOptions(options);
    } else {
      // Filter options based on input value
      setFilteredOptions(
        options.filter((option) =>
          option.toLowerCase().includes(inputValue.toLowerCase()),
        ),
      );
    }
  }, [options, inputValue, showAllOptions]);

  // Sync inputValue with value prop when it changes from outside the component
  useEffect(() => {
    if (!isInternalUpdateRef.current) {
      setInputValue(value || "");
    } else {
      // Reset the flag after handling internal update
      isInternalUpdateRef.current = false;
    }
  }, [value]);

  // Create a portal root for popover rendering (escapes any overflow:hidden ancestors)
  useEffect(() => {
    let node = document.getElementById("dropdown-portal-root");
    if (!node) {
      node = document.createElement("div");
      node.id = "dropdown-portal-root";
      document.body.appendChild(node);
    }
    portalRootRef.current = node;
  }, []);

  // Close dropdown when clicking outside, and reposition on scroll/resize so it follows the input
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setShowAllOptions(false);
      }
    };

    const reposition = () => {
      if (!isOpen || !dropdownRef.current || !menuRef.current) return;
      const r = dropdownRef.current.getBoundingClientRect();
      menuRef.current.style.left = `${r.left}px`;
      menuRef.current.style.top = `${r.bottom + 4}px`;
      menuRef.current.style.width = `${r.width}px`;
    };

    document.addEventListener("mousedown", handleClickOutside);
  window.addEventListener("scroll", reposition, { capture: true, passive: true }); // capture to catch inner scroll containers, passive to avoid blocking
  window.addEventListener("resize", reposition, { passive: true });

    // Recompute position on open next frame
    if (isOpen) {
      requestAnimationFrame(reposition);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
  window.removeEventListener("scroll", reposition, true);
  window.removeEventListener("resize", reposition);
    };
  }, [isOpen]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setShowAllOptions(false); // Reset showAllOptions when user starts typing
    // Call onChange immediately to update the parent component
    isInternalUpdateRef.current = true;
    onChange({ target: { name, value: newValue } });
  };

  const blurTimeout = useRef(null);

  const handleInputBlur = () => {
    // Debounce to avoid multiple state updates in same tick
    if (blurTimeout.current) {
      clearTimeout(blurTimeout.current);
    }
    blurTimeout.current = setTimeout(() => {
      // Only create when dropdown is open to prevent loops via prop sync
      if (isOpen && inputValue && !options.includes(inputValue)) {
        handleCreateNew();
      }
      setIsOpen(false);
      setShowAllOptions(false); // Reset showAllOptions when dropdown is closed
      blurTimeout.current = null;
    }, 200);
  };

  const handleOptionSelect = (option) => {
    setInputValue(option);
    isInternalUpdateRef.current = true;
    onChange({ target: { name, value: option } });
    setIsOpen(false);
    setShowAllOptions(false); // Reset showAllOptions when option is selected
  };

  const handleCreateNew = () => {
    if (inputValue && !options.includes(inputValue)) {
      // Mark internal update before notifying parent to avoid immediate prop-sync loop
      isInternalUpdateRef.current = true;
      onCreate(inputValue);
      onChange({ target: { name, value: inputValue } });
      setIsOpen(false);
      setShowAllOptions(false); // Reset showAllOptions when new option is created
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && inputValue) {
      if (filteredOptions.includes(inputValue)) {
        handleOptionSelect(inputValue);
      } else {
        handleCreateNew();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setShowAllOptions(false); // Reset showAllOptions when dropdown is closed
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <motion.input
          type="text"
          id={id}
          name={name}
          className="form-input w-full h-[45px]"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            // Remove haptic feedback - only notifications and "+" button should have haptic
            setIsOpen(true);
            setShowAllOptions(true); // Show all options when dropdown is first opened
          }}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          whileFocus={{ scale: 1.01 }}
          transition={{ type: "spring", stiffness: 250, damping: 20 }}
        />
      </div>
      {portalRootRef.current &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed z-50 bg-white/95 dark:bg-gray-800/95 shadow-2xl rounded-lg max-h-60 overflow-auto border border-gray-200 dark:border-gray-700 ring-1 ring-black/5 dark:ring-white/10"
                style={{
                  left: "0px",
                  top: "0px",
                  width: "240px",
                }}
              >
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option, index) => (
                    <div
                      key={index}
                      className="px-4 h-[45px] flex items-center text-gray-800 dark:text-gray-100 hover:text-white dark:hover:text-gray-900 hover:bg-blue-600 dark:hover:bg-blue-400/90 cursor-pointer transition-colors relative after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-3/4 after:border-b after:border-gray-200 dark:after:border-gray-700 last:after:border-b-0"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        handleOptionSelect(option);
                      }}
                    >
                      {option}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-2 text-gray-600 dark:text-gray-300">
                    No options found
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          portalRootRef.current,
        )}
    </div>
  );
};

export default DropdownWithInput;
