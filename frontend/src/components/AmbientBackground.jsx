import { useRef, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";

const AmbientBackground = () => {
  const canvasRef = useRef(null);
  const { theme, dark } = useTheme();
  const particles = useRef([]);
  const animationId = useRef(null);
  const frameCount = useRef(0);
  const lastTime = useRef(0);
  const particleSprites = useRef({});

  // Enhanced theme-based color schemes with gradient colors
  const colorSchemes = {
    default: {
      dark: {
        background: "#1a2237",
        particles: [
          "rgba(173,216,230,0.5)",
          "rgba(0,255,255,0.4)",
          "rgba(0,128,255,0.3)",
        ],
        gradientColors: ["#0b1220", "#1a2237", "#111827"], // Dark blue shades
      },
      light: {
        background: "#f5f7fa",
        particles: [
          "rgba(0, 84, 166, 0.45)",
          "rgba(83, 207, 255, 0.4)",
          "rgba(255,255,255,0.23)",
        ],
        gradientColors: ["#ffffff", "#f3f4f6", "#e5e7eb"], // White (brightest) -> gray-100 (brighter) -> gray-200 (darker)
      },
    },
    ocean: {
      dark: {
        background: "#071a26",
        particles: [
          "rgba(2,132,199,0.5)",
          "rgba(56,189,248,0.4)",
          "rgba(125,211,252,0.3)",
        ],
        gradientColors: ["#05121f", "#071a26", "#0b2533"], // Deep ocean shades
      },
      light: {
        background: "#f0f9ff",
        particles: [
          "rgba(2,132,199,0.4)",
          "rgba(56,189,248,0.3)",
          "rgba(191,219,254,0.2)",
        ],
        gradientColors: ["#ffffff", "#e0f2fe", "#dbeafe"], // White (brightest) -> sky-100 (brighter) -> indigo-100 (darker)
      },
    },
    forest: {
      dark: {
        background: "#0a1a10",
        particles: [
          "rgba(22,163,74,0.5)",
          "rgba(74,222,128,0.4)",
          "rgba(134,239,172,0.3)",
        ],
        gradientColors: ["#08190d", "#0a1a10", "#0f2417"], // Deep forest shades
      },
      light: {
        background: "#f7fee7",
        particles: [
          "rgba(22,163,74,0.4)",
          "rgba(74,222,128,0.3)",
          "rgba(187,247,208,0.2)",
        ],
        gradientColors: ["#ffffff", "#f7fee7", "#ecfccb"], // White (brightest) -> lime-50 (brighter) -> lime-100 (darker)
      },
    },
    rose: {
      dark: {
        background: "#1a0b10",
        particles: [
          "rgba(225,29,72,0.5)",
          "rgba(251,113,133,0.4)",
          "rgba(253,164,175,0.3)",
        ],
        gradientColors: ["#140a0f", "#1a0b10", "#2a0f19"], // Deep rose shades
      },
      light: {
        background: "#fff1f2",
        particles: [
          "rgba(225,29,72,0.4)",
          "rgba(251,113,133,0.3)",
          "rgba(254,205,211,0.2)",
        ],
        gradientColors: ["#ffffff", "#fff1f2", "#ffe4e6"], // White (brightest) -> rose-50 (brighter) -> rose-100 (darker)
      },
    },
    wednesday: {
      dark: {
        background: "#16132a",
        particles: [
          "rgba(124,58,237,0.45)",
          "rgba(167,139,250,0.35)",
          "rgba(79,70,229,0.25)",
        ],
        gradientColors: ["#0f0b1a", "#16132a", "#1f1a3a"], // Deep violet shades
      },
      light: {
        background: "#f5f3ff",
        particles: [
          "rgba(124,58,237,0.35)",
          "rgba(167,139,250,0.30)",
          "rgba(221,214,254,0.25)",
        ],
        gradientColors: ["#ffffff", "#ede9fe", "#ddd6fe"], // White -> violet-100 -> violet-200
      },
    },
  };

  const getCurrentScheme = () => {
    const scheme = colorSchemes[theme] || colorSchemes.default;
    return dark ? scheme.dark : scheme.light;
  };

  // Pre-render blurred particle sprites for better performance
  const createParticleSprites = (scheme) => {
    const sizes = [20, 30, 40]; // Different particle sizes
    const blurLevel = 7; // Increased blur level for better visual effect

    particleSprites.current = {};

    sizes.forEach((size) => {
      // Create offscreen canvas for each particle sprite
      const spriteCanvas = document.createElement("canvas");
      const spriteCtx = spriteCanvas.getContext("2d");
      const spriteSize = size + blurLevel * 2;

      spriteCanvas.width = spriteSize * 2; // Double size for padding
      spriteCanvas.height = spriteSize * 2;

      // Draw blurred particle
      spriteCtx.beginPath();
      spriteCtx.arc(spriteSize, spriteSize, size, 0, Math.PI * 2);
      spriteCtx.fillStyle = scheme.particles[0]; // Use first color as base
      spriteCtx.filter = `blur(${blurLevel}px)`;
      spriteCtx.fill();

      particleSprites.current[size] = spriteCanvas;
    });
  };

  const createParticle = (width, height) => {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 20 + Math.random() * 20, // Slightly larger range
      color: getCurrentScheme().particles[Math.floor(Math.random() * 3)],
      alpha: 0,
      targetAlpha: 0.02 + Math.random() * 0.05,
      spawning: true,
      despawning: false,
      velocity: {
        x: -0.5 + Math.random() * 1.0,
        y: -0.2 + Math.random() * 0.4,
      },
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let width = window.innerWidth;
    let height = window.innerHeight;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      // Recreate particle sprites on resize
      createParticleSprites(getCurrentScheme());
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    // Create particle sprites
    createParticleSprites(getCurrentScheme());

    // Initialize particles (reduced from 30 to 15 for better performance)
    particles.current = Array.from({ length: 15 }, () =>
      createParticle(width, height),
    );

    const animate = (timestamp) => {
      // Throttle animation to 60fps max
      if (timestamp - lastTime.current < 16) {
        animationId.current = requestAnimationFrame(animate);
        return;
      }
      lastTime.current = timestamp;

      frameCount.current++;

      // Create animated gradient background with slower movement
      const scheme = getCurrentScheme();
      const isMobile = width <= 640;
      const speedFactor = isMobile ? 0.3 : 0.7; // 70% slower than original
      const gradient = ctx.createLinearGradient(
        0,
        Math.sin(frameCount.current * speedFactor * 0.003) * height,
        width,
        Math.cos(frameCount.current * speedFactor * 0.002) * height,
      );

      gradient.addColorStop(0, scheme.gradientColors[0]);
      gradient.addColorStop(0.5, scheme.gradientColors[1]);
      gradient.addColorStop(1, scheme.gradientColors[2]);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw particles with pre-rendered blurred sprites
      particles.current.forEach((particle) => {
        if (particle.despawning) {
          particle.alpha = Math.max(particle.alpha - 0.002, 0);
          if (particle.alpha <= 0) {
            Object.assign(particle, createParticle(width, height));
          }
        } else if (particle.spawning) {
          particle.alpha = Math.min(
            particle.alpha + 0.0005,
            particle.targetAlpha,
          );
          if (particle.alpha >= particle.targetAlpha) {
            particle.spawning = false;
          }
        }

        // Use pre-rendered particle sprites instead of real-time blur
        const sizeKey = Math.min(
          Object.keys(particleSprites.current)
            .map(Number)
            .filter((s) => s >= particle.radius)[0] || 40,
          40,
        );

        if (particleSprites.current[sizeKey]) {
          const sprite = particleSprites.current[sizeKey];
          const spriteSize = sprite.width / 2;

          // Use integer positions for better performance
          const x = Math.floor(particle.x - spriteSize);
          const y = Math.floor(particle.y - spriteSize);

          ctx.globalAlpha = particle.alpha;
          ctx.drawImage(sprite, x, y);
        } else {
          // Fallback to direct drawing if sprite not available
          ctx.beginPath();
          ctx.arc(
            Math.floor(particle.x),
            Math.floor(particle.y),
            particle.radius,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = particle.color;
          ctx.globalAlpha = particle.alpha;
          ctx.fill();
        }

        particle.x += particle.velocity.x;
        particle.y += particle.velocity.y;

        // Reset particles with smooth transition
        if (
          !particle.despawning &&
          (particle.x < -50 ||
            particle.x > width + 50 ||
            particle.y < -50 ||
            particle.y > height + 50)
        ) {
          particle.despawning = true;
        }
      });

      // Reset global alpha
      ctx.globalAlpha = 1.0;

      animationId.current = requestAnimationFrame(animate);
    };

    animationId.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [theme, dark]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: -1,
        pointerEvents: "none",
      }}
    />
  );
};

export default AmbientBackground;
