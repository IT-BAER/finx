import { useRef, useEffect, useState, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext";

const themeConfig = {
  default: {
    dark: {
      gradient: "linear-gradient(135deg, #0a0f1e 0%, #000 40%, #0c1425 100%)",
      bg: "#030712",
      glow1: "rgba(37,99,235,0.15)",
      glow2: "rgba(124,58,237,0.01)",
      grid: "rgba(100,116,139,0.07)",
      accent: "rgba(148,163,184,0.08)",
      dot: "rgba(203,213,225,0.6)",
      hues: [220, 260],
      mouseGlow: "radial-gradient(circle, rgba(37,99,235,0.10) 0%, rgba(124,58,237,0.05) 40%, transparent 70%)",
    },
    light: {
      gradient: "linear-gradient(135deg, #f9fafb 0%, #ffffff 40%, #f3f4f6 100%)",
      bg: "#f9fafb",
      glow1: "rgba(37,99,235,0.04)",
      glow2: "rgba(124,58,237,0.02)",
      grid: "rgba(100,116,139,0.06)",
      accent: "rgba(100,116,139,0.06)",
      dot: "rgba(100,116,139,0.3)",
      hues: [220, 260],
      mouseGlow: "radial-gradient(circle, rgba(37,99,235,0.06) 0%, rgba(124,58,237,0.03) 40%, transparent 70%)",
    },
  },
  ocean: {
    dark: {
      gradient: "linear-gradient(135deg, #051a2e 0%, #000 40%, #071a26 100%)",
      bg: "#071a26",
      glow1: "rgba(2,132,199,0.15)",
      glow2: "rgba(56,189,248,0.01)",
      grid: "rgba(56,189,248,0.05)",
      accent: "rgba(56,189,248,0.08)",
      dot: "rgba(125,211,252,0.6)",
      hues: [195, 210],
      mouseGlow: "radial-gradient(circle, rgba(2,132,199,0.10) 0%, rgba(56,189,248,0.05) 40%, transparent 70%)",
    },
    light: {
      gradient: "linear-gradient(135deg, #f0f9ff 0%, #ffffff 40%, #e0f2fe 100%)",
      bg: "#f0f9ff",
      glow1: "rgba(2,132,199,0.04)",
      glow2: "rgba(56,189,248,0.02)",
      grid: "rgba(56,189,248,0.05)",
      accent: "rgba(56,189,248,0.06)",
      dot: "rgba(56,189,248,0.3)",
      hues: [195, 210],
      mouseGlow: "radial-gradient(circle, rgba(2,132,199,0.06) 0%, rgba(56,189,248,0.03) 40%, transparent 70%)",
    },
  },
  forest: {
    dark: {
      gradient: "linear-gradient(135deg, #061a0c 0%, #000 40%, #0a1a10 100%)",
      bg: "#0a1a10",
      glow1: "rgba(22,163,74,0.15)",
      glow2: "rgba(52,211,153,0.01)",
      grid: "rgba(74,222,128,0.05)",
      accent: "rgba(74,222,128,0.08)",
      dot: "rgba(134,239,172,0.6)",
      hues: [140, 160],
      mouseGlow: "radial-gradient(circle, rgba(22,163,74,0.10) 0%, rgba(52,211,153,0.05) 40%, transparent 70%)",
    },
    light: {
      gradient: "linear-gradient(135deg, #f7fee7 0%, #ffffff 40%, #ecfccb 100%)",
      bg: "#f7fee7",
      glow1: "rgba(22,163,74,0.04)",
      glow2: "rgba(52,211,153,0.02)",
      grid: "rgba(74,222,128,0.05)",
      accent: "rgba(74,222,128,0.06)",
      dot: "rgba(74,222,128,0.3)",
      hues: [140, 160],
      mouseGlow: "radial-gradient(circle, rgba(22,163,74,0.06) 0%, rgba(52,211,153,0.03) 40%, transparent 70%)",
    },
  },
  rose: {
    dark: {
      gradient: "linear-gradient(135deg, #1a060e 0%, #000 40%, #1a0b10 100%)",
      bg: "#1a0b10",
      glow1: "rgba(225,29,72,0.15)",
      glow2: "rgba(251,113,133,0.01)",
      grid: "rgba(251,113,133,0.05)",
      accent: "rgba(251,113,133,0.08)",
      dot: "rgba(253,164,175,0.6)",
      hues: [340, 350],
      mouseGlow: "radial-gradient(circle, rgba(225,29,72,0.10) 0%, rgba(251,113,133,0.05) 40%, transparent 70%)",
    },
    light: {
      gradient: "linear-gradient(135deg, #fff1f2 0%, #ffffff 40%, #ffe4e6 100%)",
      bg: "#fff1f2",
      glow1: "rgba(225,29,72,0.04)",
      glow2: "rgba(251,113,133,0.02)",
      grid: "rgba(251,113,133,0.05)",
      accent: "rgba(251,113,133,0.06)",
      dot: "rgba(251,113,133,0.3)",
      hues: [340, 350],
      mouseGlow: "radial-gradient(circle, rgba(225,29,72,0.06) 0%, rgba(251,113,133,0.03) 40%, transparent 70%)",
    },
  },
  wednesday: {
    dark: {
      gradient: "linear-gradient(135deg, #0d0819 0%, #000 40%, #0f0b1a 100%)",
      bg: "#0f0b1a",
      glow1: "rgba(124,58,237,0.15)",
      glow2: "rgba(79,70,229,0.01)",
      grid: "rgba(167,139,250,0.05)",
      accent: "rgba(167,139,250,0.08)",
      dot: "rgba(196,181,253,0.6)",
      hues: [260, 275],
      mouseGlow: "radial-gradient(circle, rgba(124,58,237,0.10) 0%, rgba(79,70,229,0.05) 40%, transparent 70%)",
    },
    light: {
      gradient: "linear-gradient(135deg, #f5f3ff 0%, #ffffff 40%, #ede9fe 100%)",
      bg: "#f5f3ff",
      glow1: "rgba(124,58,237,0.04)",
      glow2: "rgba(79,70,229,0.02)",
      grid: "rgba(167,139,250,0.05)",
      accent: "rgba(167,139,250,0.06)",
      dot: "rgba(167,139,250,0.3)",
      hues: [260, 275],
      mouseGlow: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, rgba(79,70,229,0.03) 40%, transparent 70%)",
    },
  },
};

const AmbientBackground = () => {
  const canvasRef = useRef(null);
  const { theme, dark } = useTheme();
  const particlesRef = useRef([]);
  const animationId = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  const cfg = (themeConfig[theme] || themeConfig.default)[dark ? "dark" : "light"];

  // Mouse-following glow (direct DOM for smooth tracking)
  const glowRef = useRef(null);
  const onMouseMove = useCallback((e) => {
    mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    if (glowRef.current) {
      glowRef.current.style.left = `${e.clientX}px`;
      glowRef.current.style.top = `${e.clientY}px`;
      glowRef.current.style.opacity = "0.5";
    }
  }, []);
  const onMouseLeave = useCallback(() => {
    mouseRef.current.active = false;
    if (glowRef.current) {
      glowRef.current.style.opacity = "0";
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [onMouseMove, onMouseLeave]);

  // Click ripples
  const [ripples, setRipples] = useState([]);
  useEffect(() => {
    const handler = (e) => {
      const id = Date.now();
      setRipples((r) => [...r, { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => setRipples((r) => r.filter((r2) => r2.id !== id)), 900);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Canvas particle system with mouse repulsion
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = window.innerWidth;
    let h = window.innerHeight;
    const MOUSE_RADIUS = 100;
    const MOUSE_FORCE = 0.08;

    const resize = () => { w = window.innerWidth; h = window.innerHeight; canvas.width = w; canvas.height = h; };
    window.addEventListener("resize", resize);
    resize();

    particlesRef.current = Array.from({ length: 20 }, (_, i) => {
      // Distribute across a 5x4 grid with jitter for even coverage
      const col = i % 5;
      const row = Math.floor(i / 5);
      return {
        x: (col + 0.5) * (w / 5) + (Math.random() - 0.5) * (w / 7),
        y: (row + 0.5) * (h / 4) + (Math.random() - 0.5) * (h / 6),
        r: 1 + Math.random() * 2,
        hue: cfg.hues[Math.random() > 0.5 ? 0 : 1],
        alpha: 0.08 + Math.random() * 0.18,
        angle: Math.random() * Math.PI * 2,
        drift: 0.0005 + Math.random() * 0.001,
        vx: (Math.random() - 0.5) * 0.05,
        vy: (Math.random() - 0.5) * 0.05,
      };
    });

    let lastTime = 0;
    const tick = (ts) => {
      if (ts - lastTime < 16) { animationId.current = requestAnimationFrame(tick); return; }
      lastTime = ts;

      ctx.clearRect(0, 0, w, h);
      const m = mouseRef.current;

      particlesRef.current.forEach((p) => {
        p.angle += p.drift;
        p.vx += Math.cos(p.angle) * 0.001;
        p.vy += Math.sin(p.angle) * 0.001;

        // Mouse repulsion
        if (m.active) {
          const dx = p.x - m.x;
          const dy = p.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_RADIUS && dist > 0) {
            const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        p.vx *= 0.997; p.vy *= 0.997;
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > 0.6) { p.vx *= 0.6 / spd; p.vy *= 0.6 / spd; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < 5) { p.x = 5; p.vx = Math.abs(p.vx) * 0.5; }
        if (p.x > w - 5) { p.x = w - 5; p.vx = -Math.abs(p.vx) * 0.5; }
        if (p.y < 5) { p.y = 5; p.vy = Math.abs(p.vy) * 0.5; }
        if (p.y > h - 5) { p.y = h - 5; p.vy = -Math.abs(p.vy) * 0.5; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, ${dark ? 70 : 45}%, ${p.alpha})`;
        ctx.fill();
      });

      animationId.current = requestAnimationFrame(tick);
    };

    animationId.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(animationId.current); window.removeEventListener("resize", resize); };
  }, [theme, dark]);

  return (
    <>
      {/* Full-screen gradient background matching landing page */}
      <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: cfg.gradient, zIndex: -2, pointerEvents: "none" }} />

      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: -1, pointerEvents: "none" }} />

      {/* Ambient gradient glows */}
      <div style={{ position: "fixed", top: "-15%", left: "-10%", width: "70%", height: "70%", background: `radial-gradient(ellipse at center, ${cfg.glow1} 0%, transparent 70%)`, filter: "blur(80px)", pointerEvents: "none", zIndex: -1 }} />
      <div style={{ position: "fixed", bottom: "-10%", right: "-5%", width: "50%", height: "50%", background: `radial-gradient(ellipse at center, ${cfg.glow2} 0%, transparent 70%)`, filter: "blur(80px)", pointerEvents: "none", zIndex: -1 }} />

      {/* SVG grid with accent lines and pulsing dots */}
      <svg style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: -1 }} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <pattern id="appGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke={cfg.grid} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#appGrid)" />
        {/* Accent grid lines and intersection dots removed — canvas particles handle ambient movement */}
      </svg>

      {/* Mouse-following gradient */}
      <div
        ref={glowRef}
        style={{
          position: "fixed",
          width: "500px",
          height: "500px",
          left: "0px",
          top: "0px",
          opacity: 0,
          transform: "translate(-50%, -50%)",
          background: cfg.mouseGlow,
          filter: "blur(60px)",
          transition: "opacity 200ms ease-out",
          willChange: "left, top, opacity",
          pointerEvents: "none",
          zIndex: -1,
        }}
      />

      {/* Click ripples */}
      {ripples.map((r) => (
        <div
          key={r.id}
          style={{
            position: "fixed",
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            left: `${r.x}px`,
            top: `${r.y}px`,
            transform: "translate(-50%, -50%)",
            background: cfg.dot,
            animation: "ambientRipple 0.8s ease-out forwards",
            pointerEvents: "none",
            zIndex: 9999,
          }}
        />
      ))}

      {/* Keyframe animations */}
      <style>{`
        @keyframes ambientPulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.2); }
        }
        @keyframes ambientRipple {
          0% { width: 4px; height: 4px; opacity: 0.6; }
          100% { width: 40px; height: 40px; opacity: 0; }
        }
      `}</style>
    </>
  );
};

export default AmbientBackground;
