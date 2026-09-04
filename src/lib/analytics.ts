import type { Transaction } from "./data-generator";

// ============ TYPES ============

export interface HourlyMetrics {
  merchant_id: string;
  hour: string;
  total_transactions: number;
  successful_transactions: number;
  failed_transactions: number;
  upi_success_rate: number;
  card_success_rate: number;
  netbanking_success_rate: number;
  overall_success_rate: number;
  checkout_conversion: number;
  refund_rate: number;
  revenue: number;
  upi_count: number;
  card_count: number;
  netbanking_count: number;
  upi_success_count: number;
  card_success_count: number;
  netbanking_success_count: number;
}

export interface BaselineResult {
  metric: string;
  current: number;
  rolling_mean: number;
  rolling_std: number;
  z_score: number;
  severity: "NORMAL" | "WATCH" | "HIGH" | "CRITICAL";
  deviation: number;
}

export interface AnomalyDetection {
  is_anomaly: boolean;
  metrics: BaselineResult[];
  worst_metric: BaselineResult | null;
  anomaly_hours: string[];
}

export interface RootCause {
  cause: string;
  contribution: number;
  current_value: number;
  baseline_value: number;
  deviation: number;
  evidence: number;
}

export interface FinancialImpact {
  baseline_daily_revenue: number;
  current_daily_revenue: number;
  revenue_deviation: number;
  revenue_deviation_pct: number;
  daily_revenue_at_risk: number;
  seven_day_revenue_at_risk: number;
}

export interface HealthScore {
  overall: number;
  payment_health: number;
  checkout_health: number;
  revenue_health: number;
  refund_health: number;
}

export interface SimulationResult {
  upi_success_rate: number;
  successful_transactions: number;
  failed_transactions: number;
  revenue: number;
  revenue_at_risk: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface MerchantComparison {
  merchant_id: string;
  merchant_name: string;
  baseline: number;
  current: number;
  z_score: number;
  severity: string;
}

// ============ HOURLY METRICS COMPUTATION ============

export function computeHourlyMetrics(transactions: Transaction[]): HourlyMetrics[] {
  const grouped = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const hour = tx.timestamp.substring(0, 13) + ":00:00Z";
    const key = `${tx.merchant_id}|${hour}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(tx);
  }

  const metrics: HourlyMetrics[] = [];

  for (const [key, txs] of grouped) {
    const [merchant_id, hour] = key.split("|");
    const total = txs.length;
    const successful = txs.filter((t) => t.payment_status === "success").length;

    const upiTxs = txs.filter((t) => t.payment_method === "UPI");
    const cardTxs = txs.filter((t) => t.payment_method === "CARD");
    const nbTxs = txs.filter((t) => t.payment_method === "NETBANKING");

    const upiSuccess = upiTxs.filter((t) => t.payment_status === "success").length;
    const cardSuccess = cardTxs.filter((t) => t.payment_status === "success").length;
    const nbSuccess = nbTxs.filter((t) => t.payment_status === "success").length;

    const checkoutStarted = txs.filter((t) => t.checkout_started).length;
    const checkoutCompleted = txs.filter((t) => t.checkout_completed).length;
    const refunded = txs.filter((t) => t.refund_status === "processed").length;
    const revenue = txs.filter((t) => t.payment_status === "success").reduce((s, t) => s + t.amount, 0);

    metrics.push({
      merchant_id,
      hour,
      total_transactions: total,
      successful_transactions: successful,
      failed_transactions: total - successful,
      upi_success_rate: upiTxs.length > 0 ? upiSuccess / upiTxs.length : 0,
      card_success_rate: cardTxs.length > 0 ? cardSuccess / cardTxs.length : 0,
      netbanking_success_rate: nbTxs.length > 0 ? nbSuccess / nbTxs.length : 0,
      overall_success_rate: total > 0 ? successful / total : 0,
      checkout_conversion: checkoutStarted > 0 ? checkoutCompleted / checkoutStarted : 0,
      refund_rate: successful > 0 ? refunded / successful : 0,
      revenue,
      upi_count: upiTxs.length,
      card_count: cardTxs.length,
      netbanking_count: nbTxs.length,
      upi_success_count: upiSuccess,
      card_success_count: cardSuccess,
      netbanking_success_count: nbSuccess,
    });
  }

  metrics.sort((a, b) => a.hour.localeCompare(b.hour));
  return metrics;
}

// ============ HELPERS ============

function computeZScore(current: number, mean: number, std: number): number {
  return (current - mean) / (std === 0 ? 1e-10 : std);
}

function severityFromZScore(z: number): "NORMAL" | "WATCH" | "HIGH" | "CRITICAL" {
  const absZ = Math.abs(z);
  if (absZ >= 3) return "CRITICAL";
  if (absZ >= 2) return "HIGH";
  if (absZ >= 1) return "WATCH";
  return "NORMAL";
}

// ============ ANOMALY DETECTION ============
// Key fix: Compare anomaly time window against the SAME time window on previous days
// This eliminates hour-of-day variance and produces meaningful z-scores

export function detectAnomalies(
  metrics: HourlyMetrics[],
  merchantId: string,
  anomalyStartHour?: string,
  anomalyEndHour?: string
): AnomalyDetection {
  const merchantMetrics = metrics.filter((m) => m.merchant_id === merchantId);
  if (merchantMetrics.length === 0) {
    return { is_anomaly: false, metrics: [], worst_metric: null, anomaly_hours: [] };
  }

  // Default: use the provided anomaly window
  const startHour = anomalyStartHour || merchantMetrics[merchantMetrics.length - 1].hour;
  // Anomaly window: 3 hours (startHour to startHour+2)
  const anomalyHours: string[] = [];
  for (let i = 0; i < 3; i++) {
    const h = parseInt(startHour.substring(11, 13)) + i;
    const dayStr = startHour.substring(0, 10);
    anomalyHours.push(`${dayStr}T${String(h).padStart(2, "0")}:00:00Z`);
  }

  // Get metrics for the anomaly window
  const anomalyWindowMetrics = merchantMetrics.filter((m) => anomalyHours.includes(m.hour));

  // Get same time window from previous days as baseline
  const anomalyDay = startHour.substring(0, 10);
  const hourStart = parseInt(startHour.substring(11, 13));
  const baselineWindowMetrics: HourlyMetrics[] = [];

  for (const m of merchantMetrics) {
    const mDay = m.hour.substring(0, 10);
    const mHour = parseInt(m.hour.substring(11, 13));
    if (mDay < anomalyDay && mHour >= hourStart && mHour < hourStart + 3) {
      baselineWindowMetrics.push(m);
    }
  }

  if (baselineWindowMetrics.length < 3) {
    // Fallback: use more baseline data
    const fallbackMetrics = merchantMetrics.filter((m) => m.hour < startHour);
    if (fallbackMetrics.length < 5) {
      return { is_anomaly: false, metrics: [], worst_metric: null, anomaly_hours: [] };
    }
    return detectAnomaliesSimple(fallbackMetrics, anomalyWindowMetrics, anomalyHours);
  }

  const metricKeys: { key: keyof HourlyMetrics; name: string }[] = [
    { key: "overall_success_rate", name: "Payment Success Rate" },
    { key: "upi_success_rate", name: "UPI Success Rate" },
    { key: "card_success_rate", name: "Card Success Rate" },
    { key: "netbanking_success_rate", name: "Netbanking Success Rate" },
    { key: "checkout_conversion", name: "Checkout Conversion" },
    { key: "refund_rate", name: "Refund Rate" },
    { key: "revenue", name: "Revenue" },
  ];

  const results: BaselineResult[] = [];

  for (const { key, name } of metricKeys) {
    const baselineValues = baselineWindowMetrics.map((m) => m[key] as number);
    const currentValues = anomalyWindowMetrics.map((m) => m[key] as number);

    if (baselineValues.length === 0 || currentValues.length === 0) continue;

    // Compute baseline statistics
    const baselineMean = baselineValues.reduce((s, v) => s + v, 0) / baselineValues.length;
    const baselineStd = Math.sqrt(baselineValues.reduce((s, v) => s + (v - baselineMean) ** 2, 0) / baselineValues.length);
    const safeStd = baselineStd === 0 ? Math.max(baselineMean * 0.01, 1e-10) : baselineStd;

    const currentMean = currentValues.reduce((s, v) => s + v, 0) / currentValues.length;
    const z = computeZScore(currentMean, baselineMean, safeStd);
    const severity = severityFromZScore(z);
    const deviation = currentMean - baselineMean;

    results.push({
      metric: name,
      current: currentMean,
      rolling_mean: baselineMean,
      rolling_std: safeStd,
      z_score: z,
      severity,
      deviation,
    });
  }

  const worstMetric = results.reduce<BaselineResult | null>((worst, r) => {
    if (!worst) return r;
    return Math.abs(r.z_score) > Math.abs(worst.z_score) ? r : worst;
  }, null);

  return {
    is_anomaly: worstMetric !== null && (worstMetric.severity === "HIGH" || worstMetric.severity === "CRITICAL"),
    metrics: results,
    worst_metric: worstMetric,
    anomaly_hours: anomalyHours,
  };
}

// Fallback simple detection using all pre-anomaly data as baseline
function detectAnomaliesSimple(
  baselineMetrics: HourlyMetrics[],
  currentMetrics: HourlyMetrics[],
  anomalyHours: string[]
): AnomalyDetection {
  const metricKeys: { key: keyof HourlyMetrics; name: string }[] = [
    { key: "overall_success_rate", name: "Payment Success Rate" },
    { key: "upi_success_rate", name: "UPI Success Rate" },
    { key: "card_success_rate", name: "Card Success Rate" },
    { key: "netbanking_success_rate", name: "Netbanking Success Rate" },
    { key: "checkout_conversion", name: "Checkout Conversion" },
    { key: "refund_rate", name: "Refund Rate" },
    { key: "revenue", name: "Revenue" },
  ];

  const results: BaselineResult[] = [];

  for (const { key, name } of metricKeys) {
    const baselineValues = baselineMetrics.map((m) => m[key] as number);
    const currentValues = currentMetrics.map((m) => m[key] as number);

    if (baselineValues.length === 0 || currentValues.length === 0) continue;

    const baselineMean = baselineValues.reduce((s, v) => s + v, 0) / baselineValues.length;
    const baselineStd = Math.sqrt(baselineValues.reduce((s, v) => s + (v - baselineMean) ** 2, 0) / baselineValues.length);
    const safeStd = baselineStd === 0 ? Math.max(baselineMean * 0.01, 1e-10) : baselineStd;

    const currentMean = currentValues.reduce((s, v) => s + v, 0) / currentValues.length;
    const z = computeZScore(currentMean, baselineMean, safeStd);
    const severity = severityFromZScore(z);

    results.push({
      metric: name,
      current: currentMean,
      rolling_mean: baselineMean,
      rolling_std: safeStd,
      z_score: z,
      severity,
      deviation: currentMean - baselineMean,
    });
  }

  const worstMetric = results.reduce<BaselineResult | null>((worst, r) => {
    if (!worst) return r;
    return Math.abs(r.z_score) > Math.abs(worst.z_score) ? r : worst;
  }, null);

  return {
    is_anomaly: worstMetric !== null && (worstMetric.severity === "HIGH" || worstMetric.severity === "CRITICAL"),
    metrics: results,
    worst_metric: worstMetric,
    anomaly_hours: anomalyHours,
  };
}

// ============ ROOT CAUSE ANALYSIS ============

export function analyzeRootCause(
  metrics: HourlyMetrics[],
  merchantId: string,
  anomalyStartHour: string
): RootCause[] {
  const merchantMetrics = metrics.filter((m) => m.merchant_id === merchantId);
  const anomalyDay = anomalyStartHour.substring(0, 10);
  const hourStart = parseInt(anomalyStartHour.substring(11, 13));

  // Get anomaly window metrics
  const anomalyHours: string[] = [];
  for (let i = 0; i < 3; i++) {
    const h = hourStart + i;
    anomalyHours.push(`${anomalyDay}T${String(h).padStart(2, "0")}:00:00Z`);
  }
  const anomalyWindowMetrics = merchantMetrics.filter((m) => anomalyHours.includes(m.hour));

  // Get same time window from previous days
  const baselineWindowMetrics = merchantMetrics.filter((m) => {
    const mDay = m.hour.substring(0, 10);
    const mHour = parseInt(m.hour.substring(11, 13));
    return mDay < anomalyDay && mHour >= hourStart && mHour < hourStart + 3;
  });

  if (baselineWindowMetrics.length < 3 || anomalyWindowMetrics.length === 0) return [];

  const causes: {
    name: string;
    key: keyof HourlyMetrics;
    higherIsBetter: boolean;
  }[] = [
    { name: "UPI Success Degradation", key: "upi_success_rate", higherIsBetter: true },
    { name: "Card Success Degradation", key: "card_success_rate", higherIsBetter: true },
    { name: "Netbanking Success Degradation", key: "netbanking_success_rate", higherIsBetter: true },
    { name: "Checkout Conversion Decline", key: "checkout_conversion", higherIsBetter: true },
    { name: "Refund Rate Increase", key: "refund_rate", higherIsBetter: false },
  ];

  const rootCauses: RootCause[] = [];

  for (const cause of causes) {
    const baselineValues = baselineWindowMetrics.map((m) => m[cause.key] as number);
    const anomalyValues = anomalyWindowMetrics.map((m) => m[cause.key] as number);

    if (baselineValues.length === 0 || anomalyValues.length === 0) continue;

    const baselineMean = baselineValues.reduce((s, v) => s + v, 0) / baselineValues.length;
    const baselineStd = Math.sqrt(baselineValues.reduce((s, v) => s + (v - baselineMean) ** 2, 0) / baselineValues.length);
    const currentMean = anomalyValues.reduce((s, v) => s + v, 0) / anomalyValues.length;

    const safeStd = baselineStd === 0 ? Math.max(baselineMean * 0.01, 1e-10) : baselineStd;
    const zScore = (currentMean - baselineMean) / safeStd;

    const isProblematic = cause.higherIsBetter ? zScore < -1 : zScore > 1;
    const problemMagnitude = cause.higherIsBetter
      ? Math.abs(Math.min(0, zScore))
      : Math.abs(Math.max(0, zScore));

    if (isProblematic || problemMagnitude > 0.3) {
      rootCauses.push({
        cause: cause.name,
        contribution: 0,
        current_value: currentMean,
        baseline_value: baselineMean,
        deviation: currentMean - baselineMean,
        evidence: zScore,
      });
    }
  }

  // Calculate contribution scores
  const totalEvidence = rootCauses.reduce((s, r) => s + Math.abs(r.evidence), 0);
  for (const rc of rootCauses) {
    rc.contribution = totalEvidence > 0 ? Math.round((Math.abs(rc.evidence) / totalEvidence) * 100) : 0;
  }

  rootCauses.sort((a, b) => b.contribution - a.contribution);
  return rootCauses;
}

// ============ FINANCIAL IMPACT ============

export function calculateFinancialImpact(
  metrics: HourlyMetrics[],
  merchantId: string,
  anomalyStartHour: string
): FinancialImpact {
  const merchantMetrics = metrics.filter((m) => m.merchant_id === merchantId);
  const anomalyDay = anomalyStartHour.substring(0, 10);
  const hourStart = parseInt(anomalyStartHour.substring(11, 13));

  // Calculate baseline daily revenue (normal days before anomaly)
  const dailyRevenues = new Map<string, number>();
  for (const m of merchantMetrics) {
    const day = m.hour.substring(0, 10);
    if (day < anomalyDay) {
      dailyRevenues.set(day, (dailyRevenues.get(day) || 0) + m.revenue);
    }
  }

  const revenues = Array.from(dailyRevenues.values());
  const baselineDailyRevenue = revenues.length > 0
    ? revenues.reduce((s, v) => s + v, 0) / revenues.length
    : 0;

  // Current day revenue
  let currentDailyRevenue = 0;
  for (const m of merchantMetrics) {
    if (m.hour.substring(0, 10) === anomalyDay) {
      currentDailyRevenue += m.revenue;
    }
  }

  // Revenue impact specifically for the anomaly window (14:00-17:00)
  // Compare anomaly window revenue vs same window on normal days
  const anomalyWindowHours: string[] = [];
  for (let i = 0; i < 3; i++) {
    anomalyWindowHours.push(`${anomalyDay}T${String(hourStart + i).padStart(2, "0")}:00:00Z`);
  }

  const anomalyWindowRevenue = merchantMetrics
    .filter((m) => anomalyWindowHours.includes(m.hour))
    .reduce((s, m) => s + m.revenue, 0);

  const baselineWindowRevenue = merchantMetrics
    .filter((m) => {
      const mDay = m.hour.substring(0, 10);
      const mHour = parseInt(m.hour.substring(11, 13));
      return mDay < anomalyDay && mHour >= hourStart && mHour < hourStart + 3;
    })
    .reduce((s, m) => s + m.revenue, 0);

  // Count how many normal days contribute to the baseline window
  const normalDaysForWindow = new Set(
    merchantMetrics
      .filter((m) => {
        const mDay = m.hour.substring(0, 10);
        const mHour = parseInt(m.hour.substring(11, 13));
        return mDay < anomalyDay && mHour >= hourStart && mHour < hourStart + 3;
      })
      .map((m) => m.hour.substring(0, 10))
  ).size;

  const baselineWindowAvg = normalDaysForWindow > 0 ? baselineWindowRevenue / normalDaysForWindow : 0;

  // Revenue at risk: use success rate gap × transaction volume × avg amount
  // This is the correct way to compute revenue lost due to UPI degradation
  const anomalyWindowMetrics = merchantMetrics.filter((m) => anomalyWindowHours.includes(m.hour));
  const baselineWindowMetrics = merchantMetrics.filter((m) => {
    const mDay = m.hour.substring(0, 10);
    const mHour = parseInt(m.hour.substring(11, 13));
    return mDay < anomalyDay && mHour >= hourStart && mHour < hourStart + 3;
  });

  let dailyRevenueAtRisk = 0;

  if (anomalyWindowMetrics.length > 0 && baselineWindowMetrics.length > 0) {
    const currentUpiRate = anomalyWindowMetrics.reduce((s, m) => s + m.upi_success_rate, 0) / anomalyWindowMetrics.length;
    const baselineUpiRate = baselineWindowMetrics.reduce((s, m) => s + m.upi_success_rate, 0) / baselineWindowMetrics.length;
    const upiRateGap = baselineUpiRate - currentUpiRate;

    // Total UPI transactions in anomaly window
    const totalUpiCount = anomalyWindowMetrics.reduce((s, m) => s + m.upi_count, 0);
    // Total successful UPI transactions
    const totalUpiSuccess = anomalyWindowMetrics.reduce((s, m) => s + m.upi_success_count, 0);

    // Average revenue per successful UPI transaction
    // Total revenue in window × UPI proportion / UPI success count
    const totalWindowRevenue = anomalyWindowMetrics.reduce((s, m) => s + m.revenue, 0);
    const upiRevenueShare = totalUpiCount > 0 
      ? (anomalyWindowMetrics.reduce((s, m) => s + m.total_transactions, 0) > 0 
          ? totalUpiCount / anomalyWindowMetrics.reduce((s, m) => s + m.total_transactions, 0) 
          : 0.55)
      : 0.55;
    const upiRevenue = totalWindowRevenue * upiRevenueShare;
    const avgUpiRevenue = totalUpiSuccess > 0 ? upiRevenue / totalUpiSuccess : 1500;

    // Lost transactions due to UPI degradation
    const lostUpiTransactions = Math.round(totalUpiCount * upiRateGap);
    const lostRevenue = lostUpiTransactions * avgUpiRevenue;

    dailyRevenueAtRisk = Math.max(0, lostRevenue);

    // If anomaly persisted for a full day, scale proportionally
    // (3 hours of anomaly per day → 8x scaling for daily rate)
    const dayScalingFactor = 24 / 3;
    dailyRevenueAtRisk = dailyRevenueAtRisk * dayScalingFactor;
  }

  const revenueDeviation = currentDailyRevenue - baselineDailyRevenue;
  const revenueDeviationPct = baselineDailyRevenue !== 0 ? revenueDeviation / baselineDailyRevenue : 0;
  const sevenDayRevenueAtRisk = dailyRevenueAtRisk * 7;

  return {
    baseline_daily_revenue: Math.round(baselineDailyRevenue),
    current_daily_revenue: Math.round(currentDailyRevenue),
    revenue_deviation: Math.round(revenueDeviation),
    revenue_deviation_pct: revenueDeviationPct,
    daily_revenue_at_risk: Math.round(dailyRevenueAtRisk),
    seven_day_revenue_at_risk: Math.round(sevenDayRevenueAtRisk),
  };
}

// ============ HEALTH SCORE ============

export function calculateHealthScore(
  metrics: HourlyMetrics[],
  merchantId: string,
  anomalyStartHour?: string
): HealthScore {
  const merchantMetrics = metrics.filter((m) => m.merchant_id === merchantId);
  if (merchantMetrics.length === 0) {
    return { overall: 0, payment_health: 0, checkout_health: 0, revenue_health: 0, refund_health: 0 };
  }

  // If we have an anomaly, compute health based on anomaly window vs baseline
  if (anomalyStartHour) {
    const anomalyDay = anomalyStartHour.substring(0, 10);
    const hourStart = parseInt(anomalyStartHour.substring(11, 13));

    const anomalyHours: string[] = [];
    for (let i = 0; i < 3; i++) {
      anomalyHours.push(`${anomalyDay}T${String(hourStart + i).padStart(2, "0")}:00:00Z`);
    }
    const currentMetrics = merchantMetrics.filter((m) => anomalyHours.includes(m.hour));
    const baselineMetrics = merchantMetrics.filter((m) => {
      const mDay = m.hour.substring(0, 10);
      const mHour = parseInt(m.hour.substring(11, 13));
      return mDay < anomalyDay && mHour >= hourStart && mHour < hourStart + 3;
    });

    if (currentMetrics.length > 0 && baselineMetrics.length > 0) {
      const curSuccess = currentMetrics.reduce((s, m) => s + m.overall_success_rate, 0) / currentMetrics.length;
      const baseSuccess = baselineMetrics.reduce((s, m) => s + m.overall_success_rate, 0) / baselineMetrics.length;
      const paymentHealth = baseSuccess > 0 ? Math.min(100, Math.max(0, (curSuccess / baseSuccess) * 100)) : 50;

      const curCheckout = currentMetrics.reduce((s, m) => s + m.checkout_conversion, 0) / currentMetrics.length;
      const baseCheckout = baselineMetrics.reduce((s, m) => s + m.checkout_conversion, 0) / baselineMetrics.length;
      const checkoutHealth = baseCheckout > 0 ? Math.min(100, Math.max(0, (curCheckout / baseCheckout) * 100)) : 50;

      const curRevenue = currentMetrics.reduce((s, m) => s + m.revenue, 0) / currentMetrics.length;
      const baseRevenue = baselineMetrics.reduce((s, m) => s + m.revenue, 0) / baselineMetrics.length;
      const revenueHealth = baseRevenue > 0 ? Math.min(100, Math.max(0, (curRevenue / baseRevenue) * 100)) : 50;

      const curRefund = currentMetrics.reduce((s, m) => s + m.refund_rate, 0) / currentMetrics.length;
      const baseRefund = baselineMetrics.reduce((s, m) => s + m.refund_rate, 0) / baselineMetrics.length;
      const refundHealth = curRefund <= baseRefund ? 100 : Math.max(0, 100 - ((curRefund - baseRefund) / Math.max(baseRefund, 0.01)) * 100);

      const overall = 0.35 * paymentHealth + 0.25 * checkoutHealth + 0.25 * revenueHealth + 0.15 * refundHealth;

      return {
        overall: Math.round(overall * 10) / 10,
        payment_health: Math.round(paymentHealth * 10) / 10,
        checkout_health: Math.round(checkoutHealth * 10) / 10,
        revenue_health: Math.round(revenueHealth * 10) / 10,
        refund_health: Math.round(refundHealth * 10) / 10,
      };
    }
  }

  // Default: use last hour vs all prior
  const last = merchantMetrics[merchantMetrics.length - 1];
  const prior = merchantMetrics.slice(0, -1);

  const baseSuccess = prior.reduce((s, m) => s + m.overall_success_rate, 0) / prior.length;
  const paymentHealth = baseSuccess > 0 ? Math.min(100, Math.max(0, (last.overall_success_rate / baseSuccess) * 100)) : 50;

  const baseCheckout = prior.reduce((s, m) => s + m.checkout_conversion, 0) / prior.length;
  const checkoutHealth = baseCheckout > 0 ? Math.min(100, Math.max(0, (last.checkout_conversion / baseCheckout) * 100)) : 50;

  const baseRevenue = prior.reduce((s, m) => s + m.revenue, 0) / prior.length;
  const revenueHealth = baseRevenue > 0 ? Math.min(100, Math.max(0, (last.revenue / baseRevenue) * 100)) : 50;

  const baseRefund = prior.reduce((s, m) => s + m.refund_rate, 0) / prior.length;
  const refundHealth = last.refund_rate <= baseRefund ? 100 : Math.max(0, 100 - ((last.refund_rate - baseRefund) / Math.max(baseRefund, 0.01)) * 100);

  const overall = 0.35 * paymentHealth + 0.25 * checkoutHealth + 0.25 * revenueHealth + 0.15 * refundHealth;

  return {
    overall: Math.round(overall * 10) / 10,
    payment_health: Math.round(paymentHealth * 10) / 10,
    checkout_health: Math.round(checkoutHealth * 10) / 10,
    revenue_health: Math.round(revenueHealth * 10) / 10,
    refund_health: Math.round(refundHealth * 10) / 10,
  };
}

// ============ WHAT-IF SIMULATION ============

export function runSimulation(
  transactions: Transaction[],
  merchantId: string,
  anomalyStartHour: string,
  simulatedUpiSuccessRate: number
): { current: SimulationResult; simulated: SimulationResult } {
  // Get transactions in the anomaly window (3 hours)
  const anomalyHours: string[] = [];
  const anomalyDay = anomalyStartHour.substring(0, 10);
  const hourStart = parseInt(anomalyStartHour.substring(11, 13));
  for (let i = 0; i < 3; i++) {
    anomalyHours.push(`${anomalyDay}T${String(hourStart + i).padStart(2, "0")}:00:00Z`);
  }

  const windowTxs = transactions.filter((t) => {
    if (t.merchant_id !== merchantId) return false;
    const txHour = t.timestamp.substring(0, 13) + ":00:00Z";
    return anomalyHours.includes(txHour);
  });

  const upiTxs = windowTxs.filter((t) => t.payment_method === "UPI");
  const nonUpiTxs = windowTxs.filter((t) => t.payment_method !== "UPI");
  const upiSuccessful = upiTxs.filter((t) => t.payment_status === "success").length;
  const currentUpiRate = upiTxs.length > 0 ? upiSuccessful / upiTxs.length : 0;

  const totalSuccessful = windowTxs.filter((t) => t.payment_status === "success").length;
  const totalFailed = windowTxs.filter((t) => t.payment_status === "failed").length;
  const currentRevenue = windowTxs
    .filter((t) => t.payment_status === "success")
    .reduce((s, t) => s + t.amount, 0);

  const current: SimulationResult = {
    upi_success_rate: currentUpiRate,
    successful_transactions: totalSuccessful,
    failed_transactions: totalFailed,
    revenue: Math.round(currentRevenue),
    revenue_at_risk: 0,
    risk_level: "LOW",
  };

  // Simulated
  const simulatedUpiSuccessful = Math.round(upiTxs.length * simulatedUpiSuccessRate);
  const simulatedUpiFailed = upiTxs.length - simulatedUpiSuccessful;

  const nonUpiSuccessful = nonUpiTxs.filter((t) => t.payment_status === "success").length;
  const nonUpiFailed = nonUpiTxs.filter((t) => t.payment_status === "failed").length;

  const simulatedSuccessful = simulatedUpiSuccessful + nonUpiSuccessful;
  const simulatedFailed = simulatedUpiFailed + nonUpiFailed;

  const avgUpiAmount = upiTxs.length > 0 ? upiTxs.reduce((s, t) => s + t.amount, 0) / upiTxs.length : 0;
  const currentUpiRevenue = upiTxs.filter((t) => t.payment_status === "success").reduce((s, t) => s + t.amount, 0);
  const simulatedUpiRevenue = simulatedUpiSuccessful * avgUpiAmount;
  const nonUpiRevenue = nonUpiTxs.filter((t) => t.payment_status === "success").reduce((s, t) => s + t.amount, 0);

  const simulatedRevenue = simulatedUpiRevenue + nonUpiRevenue;
  const revenueAtRisk = Math.max(0, currentRevenue - simulatedRevenue);

  const simulatedOverallRate = windowTxs.length > 0 ? simulatedSuccessful / windowTxs.length : 0;
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  if (simulatedOverallRate < 0.80) riskLevel = "CRITICAL";
  else if (simulatedOverallRate < 0.88) riskLevel = "HIGH";
  else if (simulatedOverallRate < 0.93) riskLevel = "MEDIUM";

  const simulated: SimulationResult = {
    upi_success_rate: simulatedUpiSuccessRate,
    successful_transactions: simulatedSuccessful,
    failed_transactions: simulatedFailed,
    revenue: Math.round(simulatedRevenue),
    revenue_at_risk: Math.round(revenueAtRisk),
    risk_level: riskLevel,
  };

  return { current, simulated };
}

// ============ MERCHANT COMPARISON ============

export function merchantRelativeComparison(
  metrics: HourlyMetrics[],
  currentSuccessRate: number
): MerchantComparison[] {
  const merchants = [
    { id: "MERCH_A_001", name: "ShopPrime Electronics", baseline: 0.98 },
    { id: "MERCH_B_001", name: "ValueMart Essentials", baseline: 0.92 },
  ];

  return merchants.map((m) => {
    const merchantMetrics = metrics.filter((met) => met.merchant_id === m.id);

    // Use the 14:00-17:00 window on normal days as baseline
    const normalDayMetrics = merchantMetrics.filter((met) => {
      const hour = parseInt(met.hour.substring(11, 13));
      return hour >= 14 && hour < 17 && met.hour.substring(0, 10) < "2025-01-11";
    });

    const baselineValues = normalDayMetrics.map((met) => met.overall_success_rate);
    if (baselineValues.length < 2) {
      // Fallback
      const allBaseline = merchantMetrics.filter((met) => met.hour.substring(0, 10) < "2025-01-11");
      const allValues = allBaseline.map((met) => met.overall_success_rate);
      const mean = allValues.reduce((s, v) => s + v, 0) / allValues.length;
      const std = Math.sqrt(allValues.reduce((s, v) => s + (v - mean) ** 2, 0) / allValues.length);
      const safeStd = std === 0 ? 0.01 : std;
      const z = (currentSuccessRate - mean) / safeStd;
      return {
        merchant_id: m.id,
        merchant_name: m.name,
        baseline: m.baseline,
        current: currentSuccessRate,
        z_score: Math.round(z * 100) / 100,
        severity: severityFromZScore(z),
      };
    }

    const mean = baselineValues.reduce((s, v) => s + v, 0) / baselineValues.length;
    const std = Math.sqrt(baselineValues.reduce((s, v) => s + (v - mean) ** 2, 0) / baselineValues.length);
    const safeStd = std === 0 ? Math.max(mean * 0.01, 1e-10) : std;
    const z = computeZScore(currentSuccessRate, mean, safeStd);

    return {
      merchant_id: m.id,
      merchant_name: m.name,
      baseline: m.baseline,
      current: currentSuccessRate,
      z_score: Math.round(z * 100) / 100,
      severity: severityFromZScore(z),
    };
  });
}

// ============ FORMATTING HELPERS ============

export function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
