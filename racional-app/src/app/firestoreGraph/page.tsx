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

type RangeKey = "1H" | "1D" | "1W" | "1M" | "3M" | "1Y" | "YTD" | "MAX";
type WithDate = InvestmentEvolution & { date: Date; id?: string };
type PortfolioMetric = "value" | "index" | "both";
const HISTOGRAM_MAX_BINS = 100;
const BETA_DOMAIN_PADDING = 0.05;

const RANGE_OPTS: { label: string; key: RangeKey }[] = [
  { key: "1H", label: "1H" },
  { key: "1D", label: "1D" },
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

function daysDiff(a: Date, b: Date) {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function filterByRange(data: WithDate[], range: RangeKey) {
  if (range === "MAX" || !data.length) return data;
  const anchor = data[data.length - 1]?.date ?? new Date();
  let cutoff = new Date(anchor);

  switch (range) {
    case "1H":
      cutoff = new Date(anchor.getTime() - 1 * 60 * 60 * 1000);
      break;
    case "1D":
      cutoff = new Date(anchor.getTime() - 24 * 60 * 60 * 1000);
      break;
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

type ReturnPair = {
  date: Date;
  portfolioReturn: number;
  benchmarkReturn: number;
};

function buildReturnPairs(data: WithDate[]): ReturnPair[] {
  if (data.length < 2) return [];
  const pairs: ReturnPair[] = [];
  let prevIndex = data[0].portfolioIndex || 0;
  for (let i = 1; i < data.length; i++) {
    const curr = data[i];
    const bench =
      prevIndex > 0 ? ((curr.portfolioIndex - prevIndex) / prevIndex) * 100 : 0;
    const portfolio = Number(curr.dailyReturn ?? 0);
    if (!Number.isNaN(portfolio) && !Number.isNaN(bench)) {
      pairs.push({
        date: curr.date,
        portfolioReturn: portfolio,
        benchmarkReturn: bench,
      });
    }
    prevIndex = curr.portfolioIndex || prevIndex;
  }
  return pairs;
}

type BetaStats = {
  beta: number;
  alpha: number;
  r2: number;
  regression: { x: number; y: number }[];
};

function computeBetaStats(pairs: ReturnPair[]): BetaStats {
  if (pairs.length < 2) return { beta: 0, alpha: 0, r2: 0, regression: [] };
  const xs = pairs.map((p) => p.benchmarkReturn);
  const ys = pairs.map((p) => p.portfolioReturn);
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  const cov =
    xs.reduce((acc, x, idx) => acc + (x - meanX) * (ys[idx] - meanY), 0) /
    xs.length;
  const varX =
    xs.reduce((acc, x) => acc + Math.pow(x - meanX, 2), 0) / xs.length;
  const varY =
    ys.reduce((acc, y) => acc + Math.pow(y - meanY, 2), 0) / ys.length;
  const beta = varX ? cov / varX : 0;
  const alpha = meanY - beta * meanX;
  const r2 =
    varX && varY ? Math.min(1, Math.max(0, (cov * cov) / (varX * varY))) : 0;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const regression = [
    { x: minX, y: alpha + beta * minX },
    { x: maxX, y: alpha + beta * maxX },
  ];
  return { beta, alpha, r2, regression };
}

function colorForReturn(value: number, mean: number, stdev: number) {
  // Divergente rojo (negativo) a verde (positivo), centrado en la media.
  const spread = stdev || 1;
  const z = Math.max(-2, Math.min(2, (value - mean) / spread)); // clamp [-2,2]
  const t = (z + 2) / 4; // [0,1]
  // Interpolación manual entre rojo (#ef4444) y verde (#16a34a)
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  const r = lerp(239, 22);
  const g = lerp(68, 163);
  const b = lerp(68, 74);
  return `rgb(${r}, ${g}, ${b})`;
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

function computeSharpeRatio(data: WithDate[]): number {
  if (!data || data.length === 0) return 0;

  const returns = data
    .map((d) => d.dailyReturn ?? 0)
    .filter((r) => !Number.isNaN(r));

  if (returns.length === 0) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / returns.length;
  const stdev = Math.sqrt(variance);

  // If standard deviation is zero, return 0 (no risk, undefined Sharpe)
  if (stdev === 0) return 0;

  // Annualize: multiply by sqrt(252) trading days per year
  // dailyReturn is already in decimal format (e.g., 0.05 for 5%)
  const sharpe = (mean / stdev) * Math.sqrt(252);

  return sharpe;
}

function computeIndexSharpeRatio(data: WithDate[]): number {
  if (!data || data.length < 2) return 0;

  // Calculate daily returns from portfolio index
  const returns: number[] = [];
  let prevIndex = data[0].portfolioIndex || 0;

  for (let i = 1; i < data.length; i++) {
    const currIndex = data[i].portfolioIndex || 0;
    if (prevIndex > 0) {
      // Calculate return as decimal (e.g., 0.05 for 5%)
      const dailyReturn = (currIndex - prevIndex) / prevIndex;
      if (!Number.isNaN(dailyReturn)) {
        returns.push(dailyReturn);
      }
    }
    prevIndex = currIndex || prevIndex;
  }

  if (returns.length === 0) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / returns.length;
  const stdev = Math.sqrt(variance);

  // If standard deviation is zero, return 0 (no risk, undefined Sharpe)
  if (stdev === 0) return 0;

  // Annualize: multiply by sqrt(252) trading days per year
  const sharpe = (mean / stdev) * Math.sqrt(252);

  return sharpe;
}

function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;
  const index = (sortedArray.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

type BoxplotStats = {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
};

function computeBoxplotStats(data: WithDate[]): {
  portfolio: BoxplotStats;
  index: BoxplotStats;
} {
  // Portfolio returns (already in decimal format)
  const portfolioReturns = data
    .map((d) => d.dailyReturn ?? 0)
    .filter((r) => !Number.isNaN(r))
    .sort((a, b) => a - b);

  // Index returns (calculate from portfolioIndex)
  const indexReturns: number[] = [];
  let prevIndex = data[0]?.portfolioIndex || 0;
  for (let i = 1; i < data.length; i++) {
    const currIndex = data[i].portfolioIndex || 0;
    if (prevIndex > 0) {
      const dailyReturn = (currIndex - prevIndex) / prevIndex;
      if (!Number.isNaN(dailyReturn)) {
        indexReturns.push(dailyReturn);
      }
    }
    prevIndex = currIndex || prevIndex;
  }
  indexReturns.sort((a, b) => a - b);

  const computeStats = (returns: number[]): BoxplotStats => {
    if (returns.length === 0) {
      return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
    }
    return {
      min: returns[0],
      q1: percentile(returns, 0.25),
      median: percentile(returns, 0.5),
      q3: percentile(returns, 0.75),
      max: returns[returns.length - 1],
    };
  };

  return {
    portfolio: computeStats(portfolioReturns),
    index: computeStats(indexReturns),
  };
}

type MonthlyBoxplotData = {
  month: string;
  date: Date;
  portfolio: BoxplotStats;
  index: BoxplotStats;
};

function computeMonthlyBoxplotStats(data: WithDate[]): MonthlyBoxplotData[] {
  if (!data || data.length === 0) return [];

  // Group data by month
  const monthlyData = new Map<
    string,
    { portfolioReturns: number[]; indexReturns: number[]; date: Date }
  >();

  let prevIndex = data[0]?.portfolioIndex || 0;

  data.forEach((d, i) => {
    const monthKey = `${d.date.getFullYear()}-${String(
      d.date.getMonth() + 1
    ).padStart(2, "0")}`;

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, {
        portfolioReturns: [],
        indexReturns: [],
        date: d.date,
      });
    }

    const monthData = monthlyData.get(monthKey)!;

    // Portfolio return
    const portfolioReturn = d.dailyReturn ?? 0;
    if (!Number.isNaN(portfolioReturn)) {
      monthData.portfolioReturns.push(portfolioReturn);
    }

    // Index return
    if (i > 0 && prevIndex > 0) {
      const currIndex = d.portfolioIndex || 0;
      const indexReturn = (currIndex - prevIndex) / prevIndex;
      if (!Number.isNaN(indexReturn)) {
        monthData.indexReturns.push(indexReturn);
      }
      prevIndex = currIndex;
    } else if (i === 0) {
      prevIndex = d.portfolioIndex || 0;
    }
  });

  // Calculate stats for each month
  const result: MonthlyBoxplotData[] = [];
  monthlyData.forEach((monthData, monthKey) => {
    const computeStats = (returns: number[]): BoxplotStats => {
      if (returns.length === 0) {
        return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
      }
      const sorted = [...returns].sort((a, b) => a - b);
      return {
        min: sorted[0],
        q1: percentile(sorted, 0.25),
        median: percentile(sorted, 0.5),
        q3: percentile(sorted, 0.75),
        max: sorted[sorted.length - 1],
      };
    };

    result.push({
      month: monthKey,
      date: monthData.date,
      portfolio: computeStats(monthData.portfolioReturns),
      index: computeStats(monthData.indexReturns),
    });
  });

  // Sort by date
  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
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
  const [portfolioMetric, setPortfolioMetric] =
    useState<PortfolioMetric>("both");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const unsub = subscribeToDocument("investmentEvolutions/user1", (data) => {
      setRaw(data);
      setLastUpdated(new Date());
      // Debug: keep a console trace for sanity
      // eslint-disable-next-line no-console
      console.log("Firestore live data", data);
    });
    return () => unsub();
  }, []);

  const parsed = useMemo(
    () =>
      normalizeToArray(raw).sort((a, b) => a.date.getTime() - b.date.getTime()),
    [raw]
  );

  const data = useMemo(() => filterByRange(parsed, range), [parsed, range]);
  const dataNormalized = useMemo(
    () => normalizePortfolioValueForComparisson(data),
    [data]
  );
  const dailyStats = useMemo(() => computeStats(data, "dailyReturn"), [data]);
  const sharpeRatio = useMemo(() => computeSharpeRatio(data), [data]);
  const indexSharpeRatio = useMemo(() => computeIndexSharpeRatio(data), [data]);
  const drawdown = useMemo(() => computeDrawdown(data), [data]);
  const mdd = useMemo(() => computeMaximumDrawdown(drawdown), [drawdown]);
  const boxplotStats = useMemo(() => computeBoxplotStats(data), [data]);
  const monthlyBoxplotStats = useMemo(
    () => computeMonthlyBoxplotStats(data),
    [data]
  );
  const monthlyBoxplotData = useMemo(() => {
    return monthlyBoxplotStats.map((m) => ({
      month: m.month,
      date: m.date,
      portfolioMin: m.portfolio.min * 100,
      portfolioQ1: m.portfolio.q1 * 100,
      portfolioMedian: m.portfolio.median * 100,
      portfolioQ3: m.portfolio.q3 * 100,
      portfolioMax: m.portfolio.max * 100,
      indexMin: m.index.min * 100,
      indexQ1: m.index.q1 * 100,
      indexMedian: m.index.median * 100,
      indexQ3: m.index.q3 * 100,
      indexMax: m.index.max * 100,
    }));
  }, [monthlyBoxplotStats]);
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
  const returnPairs = useMemo(() => buildReturnPairs(data), [data]);
  const betaStats = useMemo(() => computeBetaStats(returnPairs), [returnPairs]);

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

    const initialValue = data[0]?.portfolioValue || 0;
    const currentValue = data[data.length - 1]?.portfolioValue || 0;
    const currentIndex = data[data.length - 1]?.portfolioIndex || 0;

    // Use last value of contributions (already cumulative)
    const totalContributions = data[data.length - 1]?.contributions || 0;
    const initialContributions = data[0]?.contributions || 0;

    // Calculate net return using normalized portfolio value (indexed return)
    // portfolioValueNormalized starts at 100, so return = (finalNormalized / 100 - 1) * 100
    const lastNormalized = dataNormalized[dataNormalized.length - 1] as any;
    const finalNormalizedValue =
      lastNormalized?.portfolioValueNormalized || 100;
    const netReturn = (finalNormalizedValue / 100 - 1) * 100;

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
          <h1 style={{ margin: 0 }}>Investment Dashboard</h1>
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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#475569", fontSize: 13 }}>Serie:</span>
            <select
              value={portfolioMetric}
              onChange={(e) =>
                setPortfolioMetric(e.target.value as PortfolioMetric)
              }
              style={{
                padding: "6px 10px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#0f172a",
              }}
            >
              <option value="value">Portfolio value</option>
              <option value="index">Portfolio index</option>
              <option value="both">Ambos</option>
            </select>
          </div>
        </div>
      </header>

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
            <div
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                marginTop: "4px",
              }}
            >
              Excluyendo contribuciones
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

          {/* Portfolio Index */}
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
              Portfolio Index
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
            >
              Valor más reciente
            </div>
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
          {/* Portfolio value + index + contributions */}
          <ChartCard title="Portfolio value vs index + contributions">
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
                  formatter={(v, name) => [formatNumber(Number(v)), name]}
                />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="contributions"
                  name="Contributions"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.3}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                {(portfolioMetric === "value" ||
                  portfolioMetric === "both") && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="portfolioValue"
                    name="Portfolio value"
                    stroke="#2563eb"
                    dot={false}
                    strokeWidth={2}
                  />
                )}
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
            title={`Portfolio value vs index + contributions${
              hasData && (sharpeRatio !== 0 || indexSharpeRatio !== 0)
                ? ` (Sharpe Portfolio: ${sharpeRatio.toFixed(
                    2
                  )}, Sharpe Index: ${indexSharpeRatio.toFixed(2)})`
                : ""
            }`}
          >
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={dataNormalized}>
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
                  domain={[90, (dataMax: number) => Math.max(dataMax, 120)]}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[60, (dataMax: number) => Math.max(dataMax, 140)]}
                  tickFormatter={(v) => Number(v).toFixed(0)}
                  tickMargin={8}
                />
                <Tooltip
                  labelFormatter={(v) => formatDateLabel(new Date(v))}
                  formatter={(v, name) => {
                    const lname = name?.toString().toLowerCase() ?? "";
                    const isIndex = lname.includes("index");
                    if (isIndex) return [Number(v).toFixed(0), name];
                    return [formatNumber(Number(v)), name];
                  }}
                />
                <Legend />
                {(portfolioMetric === "value" ||
                  portfolioMetric === "both") && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="portfolioValueNormalized"
                    name="Portfolio value normalized"
                    stroke="#2563eb"
                    dot={false}
                    strokeWidth={3}
                    strokeOpacity={1}
                  />
                )}
                {(portfolioMetric === "index" ||
                  portfolioMetric === "both") && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="portfolioIndex"
                    name="Portfolio index"
                    stroke="#22c55e"
                    dot={false}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    strokeOpacity={0.8}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Sección de retornos: serie + histograma + beta */}
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
                  <div
                    style={{
                      minHeight: 220,
                      height: "28vh",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      margin: 1,
                      //   gap: 8,
                      flexGrow: 1,
                    }}
                  >
                    <h3 style={{ margin: "0 0 12px", fontSize: "16px" }}>
                      Regresión lineal entre retornos (portfolio) vs retornos
                      (portafolio index)
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 1, right: 1, left: 1, bottom: 1 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          type="number"
                          dataKey="benchmarkReturn"
                          name="Benchmark"
                          tickFormatter={(v) => `${v.toFixed(2)}%`}
                          tickMargin={8}
                          tick={{ fontSize: 11 }}
                          tickCount={5}
                          domain={[
                            (dataMin: number) => dataMin - BETA_DOMAIN_PADDING,
                            (dataMax: number) => dataMax + BETA_DOMAIN_PADDING,
                          ]}
                        />
                        <YAxis
                          type="number"
                          dataKey="portfolioReturn"
                          name="Portfolio"
                          tickFormatter={(v) => `${v.toFixed(2)}%`}
                          tickMargin={8}
                          tick={{ fontSize: 11 }}
                          tickCount={5}
                          domain={[
                            (dataMin: number) => dataMin - BETA_DOMAIN_PADDING,
                            (dataMax: number) => dataMax + BETA_DOMAIN_PADDING,
                          ]}
                        />
                        <Tooltip
                          formatter={(v, name) => [
                            `${Number(v).toFixed(2)}%`,
                            name,
                          ]}
                        />
                        <ReferenceLine x={0} stroke="#cbd5e1" />
                        <ReferenceLine y={0} stroke="#cbd5e1" />
                        <Scatter
                          name="Puntos diarios"
                          data={returnPairs}
                          fill="#7c3aed"
                          fillOpacity={0.7}
                          r={3.6}
                        />
                        {betaStats.regression.length ? (
                          <Line
                            data={betaStats.regression}
                            type="monotone"
                            dataKey="y"
                            stroke="#22c55e"
                            dot={false}
                            strokeWidth={1.6}
                          />
                        ) : null}
                      </ScatterChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        marginTop: 1,
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                        fontSize: 12,
                        color: "#0f172a",
                        alignItems: "center",
                      }}
                    >
                      <StatPill label="Beta" value={betaStats.beta} />
                      <StatPill label="Alpha" value={betaStats.alpha} />
                      <StatPill label="R²" value={betaStats.r2} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ChartCard>
        </div>
      )}
      <ChartCard title="Datos crudos (debug)">
        <div
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "Menlo, monospace",
            fontSize: "12px",
            color: "#0f172a",
          }}
        >
          <div style={{ marginBottom: 8, color: "#475569" }}>
            Última actualización:{" "}
            {lastUpdated ? lastUpdated.toISOString() : "—"}
          </div>
          <code>{JSON.stringify(raw, null, 2)}</code>
        </div>
      </ChartCard>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: "6px 10px",
        background: "#f8fafc",
        lineHeight: 1.2,
      }}
    >
      {label}: {value.toFixed(2)}
    </span>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "16px",
        background: "#fff",
      }}
    >
      <h3 style={{ margin: "0 0 12px", fontSize: "16px" }}>{title}</h3>
      {children}
    </section>
  );
}
