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
  const interactingWithMenuRef = useRef(false);
  const touchStartYRef = useRef(0);

  // Helpers
  const normalize = (s) => (typeof s === "string" ? s.trim() : s);
  const normalizeLower = (s) => (typeof s === "string" ? s.trim().toLowerCase() : s);

  // Update filtered options when options or input value changes
  useEffect(() => {
    if (showAllOptions) {
      // Show all options when dropdown is first opened
      setFilteredOptions(options.map((o) => (typeof o === "string" ? o.trim() : o)));
    } else {
      // Filter options based on input value
      const needle = String(inputValue || "").toLowerCase();
      setFilteredOptions(
        options
          .map((o) => (typeof o === "string" ? o.trim() : o))
          .filter((option) => option.toLowerCase().includes(needle)),
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
      // Match input width and clamp to viewport
      const desiredWidth = r.width;
      menuRef.current.style.width = `${desiredWidth}px`;
      let left = r.left;
      // After width is set, we can clamp left so it doesn't overflow the viewport
      const menuWidth = desiredWidth;
      const maxLeft = Math.max(0, window.innerWidth - menuWidth - 8);
      left = Math.min(left, maxLeft);
      menuRef.current.style.left = `${left}px`;
      menuRef.current.style.top = `${r.bottom + 4}px`;
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", reposition, { capture: true, passive: true }); // capture to catch inner scroll containers, passive to avoid blocking
    window.addEventListener("resize", reposition, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", reposition, { capture: true });
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen]);

  // Reposition once on open to avoid one-frame misplacement
  useEffect(() => {
    if (!isOpen) return;
    const r = dropdownRef.current?.getBoundingClientRect();
    const el = menuRef.current;
    if (!r || !el) return;
    el.style.width = `${r.width}px`;
    const menuWidth = r.width;
    const maxLeft = Math.max(0, window.innerWidth - menuWidth - 8);
    const left = Math.min(r.left, maxLeft);
    el.style.left = `${left}px`;
    el.style.top = `${r.bottom + 4}px`;

    // Attach a native non-passive wheel listener to control preventDefault safely
    const onWheelNative = (e) => {
      const target = menuRef.current;
      if (!target) return;
      const atTop = target.scrollTop <= 0;
      const atBottom = Math.ceil(target.scrollTop + target.clientHeight) >= target.scrollHeight;
      const scrollingDown = e.deltaY > 0;
      const scrollingUp = e.deltaY < 0;
      const canScroll = target.scrollHeight > target.clientHeight + 1;
      if (canScroll && !((atTop && scrollingUp) || (atBottom && scrollingDown))) {
        e.preventDefault();
        target.scrollTop += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheelNative, { passive: false });
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
      // If the user is interacting with the menu (scrolling/touching), do not close on blur
      if (interactingWithMenuRef.current) {
        // Reset flag shortly after to allow future blurs to close
        setTimeout(() => {
          interactingWithMenuRef.current = false;
        }, 150);
        return;
      }
      // Only create when dropdown is open to prevent loops via prop sync
      if (isOpen && inputValue) {
        const exists = options.some(
          (o) => normalizeLower(o) === normalizeLower(inputValue),
        );
        if (!exists) {
          handleCreateNew();
        }
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
    const trimmed = String(inputValue || "").trim();
    if (!trimmed) return;
    const exists = options.some((o) => normalizeLower(o) === trimmed.toLowerCase());
    if (!exists) {
      // Mark internal update before notifying parent to avoid immediate prop-sync loop
      isInternalUpdateRef.current = true;
      onCreate(trimmed);
      onChange({ target: { name, value: trimmed } });
      setIsOpen(false);
      setShowAllOptions(false); // Reset showAllOptions when new option is created
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && inputValue) {
      const trimmed = String(inputValue).trim();
      const existing = filteredOptions.find(
        (o) => normalizeLower(o) === trimmed.toLowerCase(),
      );
      if (existing) {
        handleOptionSelect(existing);
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
                className="fixed z-50 shadow-2xl rounded-lg overflow-auto ring-1 ring-black/5 touch-pan-y overscroll-auto"
                style={{
                  left: "0px",
                  top: "0px",
                  width: "240px",
                  maxHeight: "270px", // 6 items × 45px = 270px max height
                  WebkitOverflowScrolling: "touch",
                  backgroundColor: "color-mix(in srgb, var(--surface) 95%, transparent)",
                  border: "1px solid var(--border)",
                }}
                onTouchStart={(e) => {
                  interactingWithMenuRef.current = true;
                  touchStartYRef.current = e.touches && e.touches[0] ? e.touches[0].clientY : 0;
                }}
                onTouchMove={() => {
                  // Mark interaction to prevent input blur from closing while user scrolls
                  interactingWithMenuRef.current = true;
                }}
                onTouchEnd={() => {
                  // Slightly delay clearing to survive blur race
                  setTimeout(() => {
                    interactingWithMenuRef.current = false;
                  }, 200);
                }}
              >
                {filteredOptions.length > 0 ? (
          filteredOptions.map((option, index) => (
                    <div
                      key={index}
                      className="px-4 h-[45px] flex items-center text-[var(--text)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] cursor-pointer transition-colors border-b last:border-b-0"
                      style={{ borderColor: "var(--border)" }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        handleOptionSelect(option);
                      }}
                    >
                      {option}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-2" style={{ color: "var(--muted)" }}>
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
