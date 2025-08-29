import React, { useState, useEffect } from "react";

// Creates a lazy-loaded chart component (Bar, Line, Pie) that dynamically
// imports chart.js and react-chartjs-2, registers Chart.js registerables and
// returns the requested chart component. This keeps heavy chart libs out of
// the main bundle until a chart actually needs to render.
function createLazyChart(chartName) {
  return function LazyChart(props) {
    const [Comp, setComp] = useState(null);

    useEffect(() => {
      let mounted = true;

      (async () => {
        try {
          const [chartModule, reactChartModule, datalabels] = await Promise.all(
            [
              import("chart.js"),
              import("react-chartjs-2"),
              import("chartjs-plugin-datalabels").catch(() => ({})),
            ],
          );

          // Chart.js may export named members or a default. Normalize:
          const ChartJS =
            chartModule.Chart || chartModule.default || chartModule;
          const registerables = chartModule.registerables || [];

          // Prefer built-in registerables array, else register common pieces manually.
          try {
            if (
              registerables &&
              registerables.length &&
              typeof ChartJS.register === "function"
            ) {
              ChartJS.register(...registerables);
            } else {
              const fallbackRegs = [
                chartModule.CategoryScale,
                chartModule.LinearScale,
                chartModule.LogarithmicScale,
                chartModule.TimeScale,
                chartModule.TimeSeriesScale,
                chartModule.BarElement,
                chartModule.LineElement,
                chartModule.PointElement,
                chartModule.ArcElement,
                chartModule.BarController,
                chartModule.LineController,
                chartModule.PieController,
                chartModule.DoughnutController,
                chartModule.Tooltip,
                chartModule.Legend,
                chartModule.Filler,
              ].filter(Boolean);

              if (
                fallbackRegs.length &&
                typeof ChartJS.register === "function"
              ) {
                ChartJS.register(...fallbackRegs);
              }
            }
          } catch (e) {
            // ignore registration errors
          }

          // register datalabels plugin if present
          try {
            if (
              datalabels &&
              datalabels.default &&
              ChartJS &&
              typeof ChartJS.register === "function"
            ) {
              ChartJS.register(datalabels.default);
            }
          } catch (e) {}

          const Comp =
            reactChartModule[chartName] ||
            (reactChartModule.default && reactChartModule.default[chartName]) ||
            reactChartModule.default ||
            null;
          if (mounted) setComp(() => Comp || null);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("Failed to load chart libraries", e);
        }
      })();

      return () => {
        mounted = false;
      };
    }, []);

    const [visible, setVisible] = useState(false);
    useEffect(() => {
      if (Comp) {
        // Trigger fade-in on next animation frame so the chart mounts first
        requestAnimationFrame(() => setVisible(true));
      } else {
        setVisible(false);
      }
    }, [Comp]);

    if (!Comp) {
      return props.fallback || <div className="spinner" aria-hidden="true" />;
    }

    return (
      <div
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 350ms ease-in-out",
          height: "100%",
          width: "100%",
        }}
      >
        <Comp
          {...props}
          style={{
            ...(props && props.style ? props.style : {}),
            height: "100%",
            width: "100%",
          }}
        />
      </div>
    );
  };
}

export const LazyBar = createLazyChart("Bar");
export const LazyLine = createLazyChart("Line");
export const LazyPie = createLazyChart("Pie");

export default null;
