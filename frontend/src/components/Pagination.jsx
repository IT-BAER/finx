import React from "react";
import { useTranslation } from "../hooks/useTranslation";

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const { t } = useTranslation();

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="flex justify-between items-center mt-4">
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="relative w-14 h-14 p-3 md:w-auto md:h-auto md:p-2 rounded-lg overflow-hidden active:scale-95 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none"
        style={{
          background: `linear-gradient(to right, var(--accent-600), var(--accent))`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `linear-gradient(to right, color-mix(in srgb, var(--accent-600) 80%, #000), var(--accent-600))`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `linear-gradient(to right, var(--accent-600), var(--accent))`;
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
        <img
          src="/icons/back.svg"
          alt={t("previous")}
          className="relative z-10 w-8 h-8 md:w-6 md:h-6 filter brightness-0 invert"
        />
      </button>
      <span className="text-lg font-semibold">
        {t("page")} {currentPage} / {totalPages}
      </span>
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="relative w-14 h-14 p-3 md:w-auto md:h-auto md:p-2 rounded-lg overflow-hidden active:scale-95 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none"
        style={{
          background: `linear-gradient(to left, var(--accent-600), var(--accent))`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `linear-gradient(to left, color-mix(in srgb, var(--accent-600) 80%, #000), var(--accent-600))`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `linear-gradient(to left, var(--accent-600), var(--accent))`;
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-l from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
        <img
          src="/icons/forward.svg"
          alt={t("next")}
          className="relative z-10 w-8 h-8 md:w-6 md:h-6 filter brightness-0 invert"
        />
      </button>
    </div>
  );
};

export default Pagination;
