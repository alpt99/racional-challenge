"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Timestamp } from "firebase/firestore";
import { InvestmentEvolution, subscribeToDocument } from "./firestoreService";
import { ChartCard } from "./chartCardComponent";

type RangeKey = "1W" | "1M" | "3M" | "1Y" | "YTD" | "MAX";
type WithDate = InvestmentEvolution & { date: Date; id?: string };
const HISTOGRAM_MAX_BINS = 100;

const RANGE_OPTS: { label: string; key: RangeKey }[] = [
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "1Y", label: "1Y" },
  { key: "YTD", label: "YTD" },
  { key: "MAX", label: "Max" },
];

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object") {
    const seconds =
      typeof value.seconds === "number"
        ? value.seconds
        : typeof value._seconds === "number"
        ? value._seconds
        : null;
    if (seconds !== null) return new Date(seconds * 1000);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeToArray(raw: any): WithDate[] {
  const candidates =
    (Array.isArray(raw) && raw) ||
    raw?.array ||
    raw?.data ||
    raw?.entries ||
    raw?.evolutions ||
    raw?.points ||
    raw?.history ||
    raw?.items;

  const arr = Array.isArray(candidates)
    ? candidates
    : raw && typeof raw === "object" && Object.keys(raw).length
    ? [raw]
    : [];

  return arr
    .map((item, idx) => {
      const date = toDate(item?.date);
      if (!date) return null;
      return {
        id: item?.id ?? String(idx),
        contributions: Number(item?.contributions ?? 0),
        portfolioIndex: Number(item?.portfolioIndex ?? 0),
        portfolioValue: Number(item?.portfolioValue ?? 0),
        dailyReturn: Number(item?.dailyReturn ?? 0),
        date,
      } as WithDate;
    })
    .filter(Boolean) as WithDate[];
}

function filterByRange(data: WithDate[], range: RangeKey) {
  if (range === "MAX" || !data.length) return data;
  const anchor = data[data.length - 1]?.date ?? new Date();
  let cutoff = new Date(anchor);

  switch (range) {
    case "1W":
      cutoff = new Date(anchor.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "1M":
      cutoff = new Date(anchor);
      cutoff.setMonth(cutoff.getMonth() - 1);
      break;
    case "3M":
      cutoff = new Date(anchor);
      cutoff.setMonth(cutoff.getMonth() - 3);
      break;
    case "1Y":
      cutoff = new Date(anchor);
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      break;
    case "YTD":
      cutoff = new Date(anchor.getFullYear(), 0, 1);
      break;
    default:
      break;
  }

  return data.filter((d) => d.date >= cutoff);
}

function computeStats(data: WithDate[], key: keyof InvestmentEvolution) {
  const values = data
    .map((d) => Number(d[key]))
    .filter((n) => !Number.isNaN(n));
  if (!values.length) return { mean: 0, stdev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, stdev: Math.sqrt(variance) };
}

function computeDrawdown(
  data: WithDate[]
): { date: Date; drawdownPct: number }[] {
  let peak = Number.NEGATIVE_INFINITY;
  return data.map((d) => {
    peak = Math.max(peak, d.portfolioValue || 0);
    const dd = peak > 0 ? ((d.portfolioValue - peak) / peak) * 100 : 0;
    return { date: d.date, drawdownPct: dd };
  });
}

function computeMaximumDrawdown(
  drawdown: { date: Date; drawdownPct: number }[]
): { mdd: number; date: Date } | null {
  if (!drawdown || drawdown.length === 0) return null;

  let mdd = 0;
  let mddDate = drawdown[0].date;

  drawdown.forEach((d) => {
    if (d.drawdownPct < mdd) {
      mdd = d.drawdownPct;
      mddDate = d.date;
    }
  });

  return { mdd, date: mddDate };
}

type HistogramBin = {
  bin: string;
  count: number;
  range: [number, number];
  center: number;
};

type HistogramResult = {
  bins: HistogramBin[];
  domain: [number, number];
  binSize: number;
};

function computeHistogram(
  data: WithDate[],
  opts: {
    binSize?: number;
    binCount?: number;
    extent?: [number, number];
    maxBins?: number;
  } = {}
): HistogramResult {
  const values = data.map((d) => d.dailyReturn ?? 0);
  if (!values.length) return { bins: [], domain: [0, 0], binSize: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;
  const maxBins = opts.maxBins ?? HISTOGRAM_MAX_BINS;
  const desired =
    opts.binCount ?? Math.min(maxBins, Math.max(values.length, 1));
  const effectiveSpread = spread || 1e-4; // evita bins infinitos cuando todos los valores son iguales
  const binSize = opts.binSize ?? (effectiveSpread / desired || 0.001);
  const startForBins = opts.extent?.[0] ?? min;
  const endForBins = opts.extent?.[1] ?? (max === min ? min + binSize : max);
  const bins: HistogramBin[] = [];
  for (let bStart = startForBins; bStart <= endForBins; bStart += binSize) {
    const bEnd = bStart + binSize;
    const count = values.filter((v) => v >= bStart && v < bEnd).length;
    bins.push({
      bin: `${bStart.toFixed(1)} to ${bEnd.toFixed(1)}`,
      count,
      range: [bStart, bEnd],
      center: bStart + binSize / 2,
    });
  }
  const domainMax = endForBins;
  const domain: [number, number] = [startForBins, domainMax];
  return { bins, domain, binSize };
}

function normalizePortfolioValueForComparisson(data: WithDate[]) {
  if (!data || data.length === 0) return data;

  let normalizedValue = 100;
  const newData = data.map((d, index) => {
    if (index === 0) {
      return {
        ...d,
        portfolioValueNormalized: normalizedValue,
      };
    }
    // Calculate compound return: value = previousValue * (1 + dailyReturn)
    const dailyReturn = d.dailyReturn ?? 0;
    normalizedValue = normalizedValue * (1 + dailyReturn);
    return {
      ...d,
      portfolioValueNormalized: normalizedValue,
    };
  });
  return newData;
}

function computeIndexStats(data: WithDate[]): { mean: number; stdev: number } {
  if (!data || data.length === 0) return { mean: 0, stdev: 0 };

  // Calculate mean and standard deviation directly from portfolio index values
  const indexValues = data
    .map((d) => d.portfolioIndex || 0)
    .filter((v) => !Number.isNaN(v) && v > 0);

  if (indexValues.length === 0) return { mean: 0, stdev: 0 };

  const mean = indexValues.reduce((a, b) => a + b, 0) / indexValues.length;
  const variance =
    indexValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) /
    indexValues.length;
  const stdev = Math.sqrt(variance);

  return { mean, stdev };
}

function formatDateLabel(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDateShort(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

export default function FirestoreGraph() {
  const [raw, setRaw] = useState<any | null>(null);
  const [range, setRange] = useState<RangeKey>("MAX");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const unsub = subscribeToDocument("investmentEvolutions/user1", (data) => {
      setRaw(data);
      setLastUpdated(new Date());
      // eslint-disable-next-line no-console
      //   console.log("Firestore live data", data);
    });
    return () => unsub();
  }, []);

  const parsed = useMemo(
    () =>
      normalizeToArray(raw).sort((a, b) => a.date.getTime() - b.date.getTime()),
    [raw]
  );

  // Calculate normalized values on ALL data first (to maintain consistent starting point)
  const parsedNormalized = useMemo(
    () => normalizePortfolioValueForComparisson(parsed),
    [parsed]
  );

  // Then filter both datasets
  const data = useMemo(() => filterByRange(parsed, range), [parsed, range]);
  const dataNormalized = useMemo(
    () => filterByRange(parsedNormalized, range),
    [parsedNormalized, range]
  );

  // Calculate date range for display
  const dateRange = useMemo(() => {
    if (!data || data.length === 0) return null;
    const startDate = data[0]?.date;
    const endDate = data[data.length - 1]?.date;
    return { startDate, endDate };
  }, [data]);
  const dailyStats = useMemo(() => computeStats(data, "dailyReturn"), [data]);
  const indexStats = useMemo(() => computeIndexStats(data), [data]);
  const drawdown = useMemo(() => computeDrawdown(data), [data]);
  const mdd = useMemo(() => computeMaximumDrawdown(drawdown), [drawdown]);
  const histogramResult = useMemo(
    () =>
      computeHistogram(data, {
        binCount: HISTOGRAM_MAX_BINS,
        maxBins: HISTOGRAM_MAX_BINS,
      }),
    [data]
  );
  const histogram = histogramResult.bins;
  const histogramDomain = histogramResult.domain;

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        netReturn: 0,
        currentPortfolioValue: 0,
        totalContributions: 0,
        gain: 0,
        currentIndex: 0,
      };
    }

    const currentValue = data[data.length - 1]?.portfolioValue || 0;
    const currentIndex = data[data.length - 1]?.portfolioIndex || 0;

    const totalContributions = data[data.length - 1]?.contributions || 0;

    const firstNormalized = dataNormalized[0] as any;
    const lastNormalized = dataNormalized[dataNormalized.length - 1] as any;
    const initialNormalizedValue =
      firstNormalized?.portfolioValueNormalized || 100;
    const finalNormalizedValue =
      lastNormalized?.portfolioValueNormalized || 100;
    const netReturn =
      initialNormalizedValue > 0
        ? (finalNormalizedValue / initialNormalizedValue - 1) * 100
        : 0;

    const gain = currentValue - totalContributions;

    return {
      netReturn,
      currentPortfolioValue: currentValue,
      totalContributions,
      gain,
      currentIndex,
    };
  }, [data, dataNormalized]);

  const hasData = data.length > 0;
  const hasRaw = !!raw;

  return (
    <div
      style={{
        padding: "24px",
        display: "grid",
        gap: "16px",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Dashboard - Racional App Challenge</h1>
          <p style={{ margin: "4px 0", color: "#475569" }}>
            Datos en tiempo real desde Firestore — user1
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {RANGE_OPTS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              style={{
                padding: "6px 10px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                background: range === opt.key ? "#2563eb" : "#fff",
                color: range === opt.key ? "#fff" : "#0f172a",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>
      {dateRange && (
        <div
          style={{
            display: "flex",
            justifyContent: "right",
            alignItems: "center",
            padding: "8px 0",
            color: "#64748b",
            fontSize: "13px",
          }}
        >
          Período: {formatDateLabel(dateRange.startDate)} -{" "}
          {formatDateLabel(dateRange.endDate)}
        </div>
      )}

      {hasData && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          {/* Retorno Neto */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "20px",
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                color: "#64748b",
                marginBottom: "8px",
              }}
            >
              Retorno Neto
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: "bold",
                color: summaryMetrics.netReturn >= 0 ? "#16a34a" : "#dc2626",
              }}
            >
              {summaryMetrics.netReturn >= 0 ? "+" : ""}
              {summaryMetrics.netReturn.toFixed(2)}%
            </div>
          </div>

          {/* Valor Actual del Portafolio */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "20px",
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                color: "#64748b",
                marginBottom: "8px",
              }}
            >
              Valor Actual del Portafolio
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: "bold",
                color: "#0f172a",
                marginBottom: "12px",
              }}
            >
              {formatNumber(summaryMetrics.currentPortfolioValue)}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Contribuciones:</span>
                <span style={{ color: "#0f172a", fontWeight: "500" }}>
                  {formatNumber(summaryMetrics.totalContributions)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Ganancia:</span>
                <span
                  style={{
                    color: summaryMetrics.gain >= 0 ? "#16a34a" : "#dc2626",
                    fontWeight: "500",
                  }}
                >
                  {summaryMetrics.gain >= 0 ? "+" : ""}
                  {formatNumber(summaryMetrics.gain)}
                </span>
              </div>
            </div>
          </div>

          {/* Valor Actual del Indice de Referencia */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "20px",
              background: "#fff",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                color: "#64748b",
                marginBottom: "8px",
              }}
            >
              Valor Actual del Indice de Referencia
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: "bold",
                color: "#0f172a",
              }}
            >
              {summaryMetrics.currentIndex.toFixed(2)}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                marginTop: "4px",
              }}
            ></div>
          </div>
        </div>
      )}

      {!hasData ? (
        <div
          style={{
            border: "1px dashed #cbd5e1",
            borderRadius: "12px",
            padding: "24px",
            textAlign: "center",
            color: "#475569",
          }}
        >
          {hasRaw
            ? "Sin datos en el rango seleccionado. Prueba con otro rango."
            : "Esperando datos en tiempo real..."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {/* Portfolio value + contributions */}
          <ChartCard title="Valor del Portafolio y Contribuciones">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatDateShort(new Date(d))}
                  tickMargin={8}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={formatNumber}
                  tickMargin={8}
                  domain={[
                    (dataMin: number) => {
                      const minContributions = Math.min(
                        ...data.map((d) => d.contributions || 0)
                      );
                      const minPortfolio = Math.min(
                        ...data.map((d) => d.portfolioValue || 0)
                      );
                      const min = Math.min(minContributions, minPortfolio);
                      return Math.max(0, min * 0.9);
                    },
                    (dataMax: number) => {
                      const maxContributions = Math.max(
                        ...data.map((d) => d.contributions || 0)
                      );
                      const maxPortfolio = Math.max(
                        ...data.map((d) => d.portfolioValue || 0)
                      );
                      const max = Math.max(maxContributions, maxPortfolio);
                      return max * 1.1;
                    },
                  ]}
                />
                <Tooltip
                  labelFormatter={(v) => formatDateLabel(new Date(v))}
                  formatter={(v, name) => {
                    const value = Number(v);
                    const nameStr = name?.toString().toLowerCase() || "";
                    if (
                      nameStr.includes("portfolio") ||
                      nameStr.includes("value") ||
                      nameStr.includes("contribution")
                    ) {
                      return [
                        new Intl.NumberFormat("en", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(value),
                        name,
                      ];
                    }
                    return [formatNumber(value), name];
                  }}
                />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="contributions"
                  name="Contribuciones"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.3}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="portfolioValue"
                  name="Valor del Portafolio"
                  stroke="#2563eb"
                  dot={false}
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Drawdown */}
          <ChartCard title="Drawdown %">
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={drawdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatDateShort(new Date(d))}
                  tickMargin={8}
                />
                <YAxis
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                  tickMargin={8}
                />
                <Tooltip
                  labelFormatter={(v) => formatDateLabel(new Date(v))}
                  formatter={(v) => [`${Number(v).toFixed(2)}%`, "Drawdown"]}
                />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                {mdd && (
                  <ReferenceLine
                    y={mdd.mdd}
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    label={{
                      value: `MDD: ${mdd.mdd.toFixed(2)}%`,
                      position: "right",
                      fill: "#dc2626",
                      fontSize: 12,
                      fontWeight: "bold",
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="drawdownPct"
                  name="Drawdown %"
                  stroke="#ef4444"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Portfolio value vs index normalized */}
          <ChartCard
            title={`Valor del Indice de Referencia${
              hasData && indexStats.stdev !== 0
                ? ` (Media: ${indexStats.mean.toFixed(
                    2
                  )}, σ: ${indexStats.stdev.toFixed(2)})`
                : ""
            }`}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dataNormalized}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => formatDateShort(new Date(d))}
                  tickMargin={8}
                />
                <YAxis
                  tickFormatter={(v) => Number(v).toFixed(2)}
                  tickMargin={8}
                  domain={[
                    (dataMin: number) => {
                      const minIndex = Math.min(
                        ...dataNormalized.map((d) => d.portfolioIndex || 0)
                      );
                      return Math.max(0, minIndex * 0.95);
                    },
                    (dataMax: number) => {
                      const maxIndex = Math.max(
                        ...dataNormalized.map((d) => d.portfolioIndex || 0)
                      );
                      return maxIndex * 1.05;
                    },
                  ]}
                />
                <Tooltip
                  labelFormatter={(v) => formatDateLabel(new Date(v))}
                  formatter={(v) => [Number(v).toFixed(2), "Portfolio index"]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="portfolioIndex"
                  name="Portfolio index"
                  stroke="#22c55e"
                  dot={false}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  strokeOpacity={0.8}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Sección de retornos: serie + beta */}
          <ChartCard title="Retornos historicos">
            {!hasData ? (
              <p style={{ margin: 0, color: "#475569" }}>Sin datos.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ minHeight: 200, height: "26vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => formatDateShort(new Date(d))}
                        tickMargin={8}
                      />
                      <YAxis tickFormatter={formatPercent} tickMargin={8} />
                      <Tooltip
                        labelFormatter={(v) => formatDateLabel(new Date(v))}
                        formatter={(v) => [
                          formatPercent(Number(v)),
                          "Daily return",
                        ]}
                      />
                      <ReferenceLine
                        y={0}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                      />
                      <ReferenceArea
                        y1={dailyStats.mean - dailyStats.stdev}
                        y2={dailyStats.mean + dailyStats.stdev}
                        fill="#bfdbfe"
                        fillOpacity={0.3}
                        ifOverflow="extendDomain"
                      />
                      <Area
                        type="monotone"
                        dataKey="dailyReturn"
                        name="Daily return"
                        stroke="#7c3aed"
                        fill="#c4b5fd"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      flexGrow: 1,
                      margin: 1,
                      minHeight: 220,
                      height: "28vh",
                    }}
                  >
                    <h3 style={{ margin: "0 0 12px", fontSize: "16px" }}>
                      Distribución de retornos
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={histogram}
                        margin={{ top: 1, right: 1, left: 1, bottom: 1 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="center"
                          type="number"
                          domain={histogramDomain}
                          tickFormatter={(v) => `${v.toFixed(3)}%`}
                          tickMargin={8}
                          tickCount={8}
                          allowDecimals
                        />
                        <YAxis tickMargin={8} />
                        <Tooltip
                          formatter={(v, _n, payload) => [
                            v,
                            `${payload?.payload?.range?.[0]?.toFixed(
                              2
                            )}% a ${payload?.payload?.range?.[1]?.toFixed(2)}%`,
                          ]}
                        />
                        <ReferenceLine
                          x={dailyStats.mean}
                          stroke="#0ea5e9"
                          strokeDasharray="4 4"
                          label={{ position: "top", value: "Media" }}
                        />
                        <ReferenceLine
                          x={dailyStats.mean - dailyStats.stdev}
                          stroke="#94a3b8"
                          strokeDasharray="2 4"
                          label={{ position: "top", value: "-1σ" }}
                        />
                        <ReferenceLine
                          x={dailyStats.mean + dailyStats.stdev}
                          stroke="#94a3b8"
                          strokeDasharray="2 4"
                          label={{ position: "top", value: "+1σ" }}
                        />
                        <Bar
                          dataKey="count"
                          name="Días"
                          fill="#0ea5e9"
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
