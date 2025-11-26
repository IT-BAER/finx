import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import ProtectedRoute from "./ProtectedRoute.jsx";
import CachedPage from "./CachedPage.jsx";
import useOfflineAPI from "../hooks/useOfflineAPI.js";

// Lazy load the page components so heavy pages are only loaded when needed.
const Dashboard = React.lazy(() => import("../pages/Dashboard.jsx"));
const Transactions = React.lazy(() => import("../pages/Transactions.jsx"));
const Reports = React.lazy(() => import("../pages/Reports.jsx"));
const Goals = React.lazy(() => import("../pages/Goals.jsx"));
const Login = React.lazy(() => import("../pages/Login.jsx"));
const Register = React.lazy(() => import("../pages/Register.jsx"));

const SWIPEABLE_ROUTES = [
  { path: "/dashboard", component: Dashboard },
  { path: "/transactions", component: Transactions },
  { path: "/reports", component: Reports },
  { path: "/goals", component: Goals },
];

export default function SwipeableRoutesInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOnline } = useOfflineAPI();
  const swiperRef = useRef(null);
  const pageRefs = useRef({});

  // Ensure we have a valid index (default to 0 if route not found)
  const foundIndex = SWIPEABLE_ROUTES.findIndex(
    (route) => route.path === location.pathname,
  );
  const currentIndex = foundIndex === -1 ? 0 : foundIndex;

  // Keep swiper position in sync with route changes
  useEffect(() => {
    if (!swiperRef.current || typeof swiperRef.current.slideTo !== "function")
      return;

    // If navigation originated from a swipe-driven slide change, jump instantly (no animation).
    if (window.__finx_programmatic_slide) {
      swiperRef.current.slideTo(currentIndex, 0);
      // Clear the flag so future navigations animate normally.
      window.__finx_programmatic_slide = false;
      return;
    }

    // If navigation was initiated by a menu tap we should animate the slide transition.
    if (window.__finx_navigate_with_animation) {
      const speed = 300; // ms - adjust for desired feel
      swiperRef.current.slideTo(currentIndex, speed);
      window.__finx_navigate_with_animation = false;
      return;
    }

    // Default: jump without animation to keep things in sync (fallback)
    swiperRef.current.slideTo(currentIndex, 0);
  }, [currentIndex, location.key]);

  // Ensure each slide manages its own height; clear any inline heights and let Swiper autoHeight handle it
  useEffect(() => {
    if (!swiperRef.current) return;
    try {
      const slides = swiperRef.current.slides || [];
      slides.forEach((slide) => {
        if (slide && slide.style) slide.style.height = "";
      });
      if (
        pageRefs.current &&
        pageRefs.current[currentIndex] &&
        pageRefs.current[currentIndex].parentElement
      ) {
        pageRefs.current[currentIndex].parentElement.style.height = "";
      }
      if (typeof swiperRef.current.updateAutoHeight === "function") {
        swiperRef.current.updateAutoHeight(0);
      }
    } catch (e) {
      // noop
    }
  }, [currentIndex]);

  // Recompute wrapper height whenever the active page's content height changes (e.g., infinite scroll appends)
  useEffect(() => {
    if (!swiperRef.current) return;
    const el = pageRefs.current?.[currentIndex];
    if (!el) return;
    let rafId = null;
    const ro = new ResizeObserver(() => {
      if (!swiperRef.current || typeof swiperRef.current.updateAutoHeight !== "function") return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        try {
          swiperRef.current.updateAutoHeight(0);
        } catch (e) {}
      });
    });
    ro.observe(el, { box: "content-box" });

    // Also respond to explicit update requests from pages (e.g., infinite scroll appended)
    const onUpdate = () => {
      try {
        swiperRef.current?.updateAutoHeight?.(0);
      } catch (e) {}
    };
    window.addEventListener('finxUpdateAutoHeight', onUpdate);
    return () => {
      try { ro.disconnect(); } catch (e) {}
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('finxUpdateAutoHeight', onUpdate);
    };
  }, [currentIndex]);

  const onSlideChange = (swiperInstance) => {
    const newIndex = swiperInstance.activeIndex;
    const route = SWIPEABLE_ROUTES[newIndex];
    if (!route) return;

  // Maintain previous offline behavior for goals only (requires server sync); allow reports offline (uses cached data)
  if (!isOnline && route.path === "/goals") {
      // revert to previous slide
      if (typeof swiperInstance.slideTo === "function") {
        swiperInstance.slideTo(currentIndex);
      }
      return;
    }

    if (route.path !== location.pathname) {
      // Mark that navigation was initiated by a swipe so the route sync logic
      // will jump without additional animation on the target slide.
      try {
        window.__finx_programmatic_slide = true;
      } catch (e) {}
      navigate(route.path);
    }
  };

  return (
    <div className="swipeable-wrapper">
      <Swiper
        onSwiper={(instance) => {
          swiperRef.current = instance;
        }}
        initialSlide={currentIndex}
        slidesPerView={1}
        spaceBetween={0}
        speed={150} // Ultra fast transition animation
  autoHeight={true}
        threshold={6} // Slightly reduced distance to trigger swipe (was 10)
        longSwipesMs={30} // Faster recognition
        longSwipesRatio={0.12} // Reduced minimal ratio required for long swipe (was 0.15)
        followFinger={true} // Natural tracking during swipe
        shortSwipes={true} // Allow small swipes
        // Allow click events immediately after a swipe ends.
        // Swiper defaults to preventing clicks right after swipes which can
        // cause the "requires two taps" behavior when a user swipes to a page
        // and immediately taps an item. We disable Swiper's click suppression
        // and also nudge internal allowClick to be true on touch end.
        preventClicks={false}
        preventClicksPropagation={false}
        onTouchEnd={() => {
          if (swiperRef.current) {
            try {
              // allowClick is an internal flag Swiper uses to suppress clicks;
              // setting it to true here ensures the first tap after a swipe is accepted.
              swiperRef.current.allowClick = true;
            } catch (e) {
              // ignore if internal API unavailable
            }
          }
        }}
        className="mySwiper swipeable-container main-content relative overflow-hidden"
        onSlideChange={onSlideChange}
      >
        {SWIPEABLE_ROUTES.map((route, i) => {
          const Component = route.component;
          // Only mount the active slide and its immediate neighbors to reduce offscreen rendering
          const shouldMount = Math.abs(i - currentIndex) <= 1;
          return (
            <SwiperSlide key={route.path}>
              <div
                ref={(el) => (pageRefs.current[i] = el)}
                className="swipeable-page"
              >
                <ProtectedRoute>
                  <React.Suspense
                    fallback={
                      <div className="flex items-center justify-center h-64">
                        <div className="spinner"></div>
                      </div>
                    }
                  >
                    <CachedPage
                      cacheKey={route.path}
                      dynamicProps={location.pathname}
                      preloadUrls={[route.path]}
                    >
                      <Component />
                    </CachedPage>
                  </React.Suspense>
                </ProtectedRoute>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
