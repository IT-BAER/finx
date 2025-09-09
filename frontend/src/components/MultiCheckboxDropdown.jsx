import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "./Icon.jsx";

export default function MultiCheckboxDropdown({
  options = [],
  selected = [],
  onChange,
  label = "",
  allLabel = "All sources",
  id = "",
  name = "",
  noBorder = false,
  useIcon = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const portalRootRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0, width: 0 });
  const scheduledRef = useRef(false);

  useEffect(() => {
    let node = document.getElementById("dropdown-portal-root");
    if (!node) {
      node = document.createElement("div");
      node.id = "dropdown-portal-root";
      document.body.appendChild(node);
    }
    portalRootRef.current = node;
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (event) => {
      const triggerEl = dropdownRef.current;
      const menuEl = menuRef.current;
      // If click/touch started inside trigger or menu, ignore
      if ((triggerEl && triggerEl.contains(event.target)) || (menuEl && menuEl.contains(event.target))) {
        return;
      }
      setIsOpen(false);
    };

    // Use capture to avoid other components stopping propagation
    document.addEventListener("pointerdown", handlePointerDownOutside, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside, true);
    };
  }, [isOpen]);

  // Close when scrolling outside the dropdown/menu
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOutside = (event) => {
      const target = event.target;
      const triggerEl = dropdownRef.current;
      const menuEl = menuRef.current;
      if (!triggerEl || !menuEl) return;
      const insideTrigger = triggerEl.contains(target);
      const insideMenu = menuEl.contains(target);
      if (!insideTrigger && !insideMenu) {
        setIsOpen(false);
      }
    };

    // Use capture to catch scroll on ancestors; also listen on window for page scroll
    document.addEventListener("scroll", handleScrollOutside, true);
    window.addEventListener("scroll", handleScrollOutside, true);

    return () => {
      document.removeEventListener("scroll", handleScrollOutside, true);
      window.removeEventListener("scroll", handleScrollOutside, true);
    };
  }, [isOpen]);

  const allSelected = selected.length === 0 || selected.length === options.length;

  const handleToggle = (id) => {
    if (id === "__ALL__") {
      onChange([]);
    } else {
      let newSelected;
      if (selected.includes(id)) {
        newSelected = selected.filter((s) => s !== id);
      } else {
        newSelected = [...selected, id];
      }
      onChange(newSelected);
    }
  };

  // Recompute & clamp position when open with rAF scheduling
  useEffect(() => {
    if (!isOpen) return;
    const compute = () => {
      const r = dropdownRef.current?.getBoundingClientRect();
      if (!r) return;
      const desired = Math.max(r.width, useIcon ? 220 : 200);
      const margin = 8;
      const maxWidth = window.innerWidth - margin * 2;
      const width = Math.min(desired, maxWidth);
      let left = r.left + r.width / 2 - width / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      let top = r.bottom + 4;
      const menuHeightEstimate = 300;
      if (top + menuHeightEstimate > window.innerHeight - 16 && r.top > menuHeightEstimate) {
        top = r.top - menuHeightEstimate - 8;
      }
      setMenuPos({ left, top, width });
    };
    const schedule = () => {
      if (scheduledRef.current) return;
      scheduledRef.current = true;
      requestAnimationFrame(() => {
        scheduledRef.current = false;
        compute();
      });
    };
    compute();
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("resize", schedule);
    };
  }, [isOpen, useIcon]);

  // Handle wheel scrolling inside the dropdown menu
  useEffect(() => {
    if (!isOpen) return;
    const el = menuRef.current;
    if (!el) return;

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

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Style matches Dropdown.jsx (trigger kept minimal when icon)
  return (
    <div className="relative" ref={dropdownRef} style={{ minWidth: useIcon ? 40 : 180 }}>
      {label && !useIcon && <label htmlFor={id} className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        className={
          useIcon
            ? "p-2 !pb-[4px] rounded-lg transition-colors focus:outline-none hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
            : `form-input w-full h-[45px] flex items-center justify-between cursor-pointer ${noBorder ? "border-b-0" : ""}`
        }
        onClick={() => setIsOpen((v) => !v)}
        id={id}
        name={name}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={useIcon ? label : undefined}
      >
        {useIcon ? (
          <Icon
            src="/icons/filter.svg"
            alt="Filter"
            size="md"
            variant="default"
            className="align-middle"
          />
        ) : (
          <>
            <span className="truncate">
              {allSelected ? allLabel : `${selected.length} selected`}
            </span>
            <motion.svg
              className="w-4 h-4 ml-2"
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
          </>
        )}
      </motion.button>
      {portalRootRef.current && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed z-50 shadow-2xl rounded-lg overflow-auto ring-1 ring-black/5 touch-pan-y overscroll-auto max-h-[50vh] md:max-h-80"
              style={{
                left: menuPos.left,
                top: menuPos.top,
                width: menuPos.width,
                backgroundColor: 'color-mix(in srgb, var(--surface) 95%, transparent)',
                border: '1px solid var(--border)',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              <div
                className="sticky top-0 px-4 h-[45px] flex items-center text-[var(--text)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] cursor-pointer transition-colors border-b"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--surface) 95%, transparent)',
                  borderColor: 'var(--border)'
                }}
              >
                <label className="flex items-center gap-2 cursor-pointer text-sm w-full">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => handleToggle('__ALL__')}
                    className="form-checkbox h-4 w-4 text-blue-600"
                  />
                  <span className="truncate font-medium text-[var(--text)]">{allLabel}</span>
                </label>
              </div>
              <div>
                {options.map((opt) => {
                  const checked = allSelected || selected.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      className="px-4 h-[45px] flex items-center text-[var(--text)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)] cursor-pointer transition-colors border-b last:border-b-0"
                      style={{
                        borderColor: 'var(--border)'
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleToggle(opt.id)}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        readOnly
                        className="form-checkbox h-4 w-4 text-blue-600 mr-2"
                      />
                      <span className="truncate text-sm text-[var(--text)]">{opt.displayName || opt.name || opt.label || opt.source_name || opt.id}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        portalRootRef.current
      )}
    </div>
  );
}
