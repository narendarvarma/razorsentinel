import { generateAllTransactions, ANOMALY } from "./data-generator";
import {
  computeHourlyMetrics,
  detectAnomalies,
  analyzeRootCause,
  calculateFinancialImpact,
  calculateHealthScore,
  type HourlyMetrics,
  type AnomalyDetection,
  type RootCause,
  type FinancialImpact,
  type HealthScore,
} from "./analytics";
import type { Transaction } from "./data-generator";

export interface DashboardData {
  merchantId: string;
  merchantName: string;
  healthScore: HealthScore;
  totalRevenue: number;
  totalTransactions: number;
  paymentSuccessRate: number;
  checkoutConversion: number;
  refundRate: number;
  anomaly: AnomalyDetection;
  financialImpact: FinancialImpact;
  rootCauses: RootCause[];
  hourlyMetrics: HourlyMetrics[];
  anomalyHour: string;
  anomalyDay: string;
}

let cachedTransactions: Transaction[] | null = null;
let cachedMetrics: HourlyMetrics[] | null = null;
let cachedDashboard: Map<string, DashboardData> | null = null;

function getTransactions(): Transaction[] {
  if (!cachedTransactions) {
    cachedTransactions = generateAllTransactions(42);
  }
  return cachedTransactions;
}

function getMetrics(): HourlyMetrics[] {
  if (!cachedMetrics) {
    cachedMetrics = computeHourlyMetrics(getTransactions());
  }
  return cachedMetrics;
}

export function getDashboardData(merchantId: string): DashboardData {
  const dashboards = getAllDashboards();
  const data = dashboards.get(merchantId);
  if (!data) throw new Error(`Merchant ${merchantId} not found`);
  return data;
}

export function getAllDashboards(): Map<string, DashboardData> {
  if (cachedDashboard) return cachedDashboard;

  const transactions = getTransactions();
  const metrics = getMetrics();

  const anomalyDay = "2025-01-11";
  const anomalyStartHour = `${anomalyDay}T${String(ANOMALY.startHour).padStart(2, "0")}:00:00Z`;
  const anomalyEndHour = `${anomalyDay}T${String(ANOMALY.endHour).padStart(2, "0")}:00:00Z`;

  const merchantIds = ["MERCH_A_001", "MERCH_B_001"];
  const merchantNames: Record<string, string> = {
    MERCH_A_001: "ShopPrime Electronics",
    MERCH_B_001: "ValueMart Essentials",
  };

  cachedDashboard = new Map();

  for (const mId of merchantIds) {
    const mMetrics = metrics.filter((m) => m.merchant_id === mId);
    const mTxs = transactions.filter((t) => t.merchant_id === mId);

    const isAnomalyMerchant = mId === "MERCH_A_001";
    const refStartHour = isAnomalyMerchant ? anomalyStartHour : mMetrics[mMetrics.length - 1]?.hour || anomalyStartHour;
    const refEndHour = isAnomalyMerchant ? anomalyEndHour : undefined;

    const anomaly = isAnomalyMerchant
      ? detectAnomalies(metrics, mId, anomalyStartHour, anomalyEndHour)
      : detectAnomalies(metrics, mId, mMetrics[mMetrics.length - 1]?.hour || anomalyStartHour);

    const rootCauses = isAnomalyMerchant ? analyzeRootCause(metrics, mId, anomalyStartHour) : [];
    const financialImpact = calculateFinancialImpact(metrics, mId, refStartHour);
    const healthScore = calculateHealthScore(metrics, mId, isAnomalyMerchant ? anomalyStartHour : undefined);

    const latestMetrics = mMetrics[mMetrics.length - 1];
    const totalRevenue = mTxs.filter((t) => t.payment_status === "success").reduce((s, t) => s + t.amount, 0);

    cachedDashboard.set(mId, {
      merchantId: mId,
      merchantName: merchantNames[mId],
      healthScore,
      totalRevenue: Math.round(totalRevenue),
      totalTransactions: mTxs.length,
      paymentSuccessRate: latestMetrics?.overall_success_rate || 0,
      checkoutConversion: latestMetrics?.checkout_conversion || 0,
      refundRate: latestMetrics?.refund_rate || 0,
      anomaly,
      financialImpact,
      rootCauses,
      hourlyMetrics: mMetrics,
      anomalyHour: refStartHour,
      anomalyDay,
    });
  }

  return cachedDashboard;
}

export function getTransactionsForMerchant(merchantId: string): Transaction[] {
  return getTransactions().filter((t) => t.merchant_id === merchantId);
}

export function getAllTransactions(): Transaction[] {
  return getTransactions();
}

export function getHourlyMetrics(): HourlyMetrics[] {
  return getMetrics();
}

export function resetCache() {
  cachedTransactions = null;
  cachedMetrics = null;
  cachedDashboard = null;
}
