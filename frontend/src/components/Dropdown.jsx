import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

const Dropdown = ({
  options = [],
  value = "",
  onChange,
  placeholder = "",
  label = "",
  required = false,
  id = "",
  name = "",
  noBorder = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const portalRootRef = useRef(null);

  // Create a portal root for popover rendering
  useEffect(() => {
    let node = document.getElementById("dropdown-portal-root");
    if (!node) {
      node = document.createElement("div");
      node.id = "dropdown-portal-root";
      document.body.appendChild(node);
    }
    portalRootRef.current = node;
  }, []);

  // Close dropdown when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    // rAF-scheduled reposition to avoid multiple layout reads per frame
    let scheduled = false;
    const scheduleReposition = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (!isOpen || !dropdownRef.current || !menuRef.current) return;
        const r = dropdownRef.current.getBoundingClientRect();
        menuRef.current.style.left = `${r.left}px`;
        menuRef.current.style.top = `${r.bottom + 4}px`;
        menuRef.current.style.width = `${r.width}px`;
      });
    };

    const handleScroll = (event) => {
      // If the user is scrolling inside the dropdown menu or the trigger, keep it open and reposition
      if (
        menuRef.current &&
        (menuRef.current === event.target ||
          menuRef.current.contains(event.target))
      ) {
        scheduleReposition();
        return;
      }
      if (
        dropdownRef.current &&
        (dropdownRef.current === event.target ||
          dropdownRef.current.contains(event.target))
      ) {
        scheduleReposition();
        return;
      }
      // For other scrolls (page scrolling), do not force-close the menu — just reposition so it follows the trigger.
      scheduleReposition();
    };

    const reposition = () => {
      // Use the same scheduled reposition to avoid layout thrash
      scheduleReposition();
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", reposition);

    if (isOpen) {
      requestAnimationFrame(() => scheduleReposition());
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen]);

  const handleSelect = (selectedValue) => {
    onChange({ target: { name, value: selectedValue } });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <motion.div
        className={
          "form-input flex items-center justify-between cursor-pointer" +
          (noBorder ? " border-b-0" : "")
        }
        onClick={() => {
          // Remove haptic feedback - only notifications and "+" button should have haptic
          setIsOpen(!isOpen);
        }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      >
        <span className={value ? "" : "text-gray-400 dark:text-gray-500"}>
          {options.find((o) => o.value === value)?.label || placeholder}
        </span>
        <motion.svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </motion.svg>
      </motion.div>

      {portalRootRef.current &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="fixed z-[99999] bg-white/95 dark:bg-gray-800/95 shadow-2xl rounded-lg max-h-60 overflow-auto border border-gray-200 dark:border-gray-700 ring-1 ring-black/5 dark:ring-white/10"
                style={{
                  left: "0px",
                  top: "0px",
                  width: "240px",
                }}
              >
                {options.map((option) => (
                  <div
                    key={option.value}
                    className={`px-4 py-2 text-gray-800 dark:text-gray-100 hover:text-white dark:hover:text-gray-900 hover:bg-blue-600 dark:hover:bg-blue-400/90 cursor-pointer transition-colors ${
                      option.value === value
                        ? "bg-blue-600 dark:bg-blue-400/90 text-white dark:text-gray-900"
                        : ""
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleSelect(option.value);
                    }}
                  >
                    {option.label}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          portalRootRef.current,
        )}
    </div>
  );
};

export default Dropdown;
