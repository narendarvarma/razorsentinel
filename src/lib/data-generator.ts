// Seeded PRNG - Mulberry32
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Transaction {
  transaction_id: string;
  merchant_id: string;
  merchant_name: string;
  timestamp: string;
  amount: number;
  payment_method: "UPI" | "CARD" | "NETBANKING";
  payment_status: "success" | "failed";
  failure_reason: string | null;
  checkout_started: boolean;
  checkout_completed: boolean;
  order_status: string | null;
  refund_status: string | null;
  customer_type: "new" | "returning";
  device_type: "mobile" | "desktop" | "tablet";
}

export interface MerchantConfig {
  id: string;
  name: string;
  normalSuccessRates: Record<string, number>;
  checkoutConversion: number;
  refundRate: number;
  avgAmount: number;
  dailyVolume: number;
}

const MERCHANT_A: MerchantConfig = {
  id: "MERCH_A_001",
  name: "ShopPrime Electronics",
  normalSuccessRates: { UPI: 0.98, CARD: 0.97, NETBANKING: 0.95 },
  checkoutConversion: 0.72,
  refundRate: 0.03,
  avgAmount: 1850,
  dailyVolume: 420,
};

const MERCHANT_B: MerchantConfig = {
  id: "MERCH_B_001",
  name: "ValueMart Essentials",
  normalSuccessRates: { UPI: 0.92, CARD: 0.90, NETBANKING: 0.88 },
  checkoutConversion: 0.65,
  refundRate: 0.05,
  avgAmount: 720,
  dailyVolume: 350,
};

// Anomaly config for Merchant A
const ANOMALY = {
  merchantId: "MERCH_A_001",
  method: "UPI" as const,
  startHour: 14, // 2:00 PM
  endHour: 17, // 5:00 PM
  degradedSuccessRate: 0.82, // drops from 98% to ~82%
  dayOffset: 5, // anomaly happens on day 5 (0-indexed) from start
};

function chooseWeighted(rng: () => number, items: string[], weights: number[]): string {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function generateHourlyVolume(hour: number, isWeekend: boolean, rng: () => number): number {
  // Realistic e-commerce traffic pattern
  const basePatterns = [
    0.15, 0.10, 0.08, 0.06, 0.05, 0.08, // 0-5 AM (night)
    0.15, 0.30, 0.55, 0.75, 0.90, 1.00, // 6-11 AM (morning ramp)
    0.95, 0.90, 0.92, 0.88, 0.85, 0.80, // 12-5 PM (afternoon)
    0.90, 0.95, 0.85, 0.70, 0.45, 0.25, // 6-11 PM (evening)
  ];

  let factor = basePatterns[hour];
  if (isWeekend) {
    factor *= hour >= 10 && hour <= 16 ? 1.3 : 0.8;
  }
  return Math.max(1, Math.round(factor * 20 + (rng() - 0.5) * 4));
}

function generateAmount(method: string, avgAmount: number, rng: () => number): number {
  // Different amount distributions by payment method
  const multipliers: Record<string, [number, number]> = {
    UPI: [0.4, 1.2],
    CARD: [0.8, 2.5],
    NETBANKING: [1.0, 3.0],
  };
  const [min, max] = multipliers[method] || [0.5, 2.0];
  // Log-normal-ish distribution
  const u1 = rng();
  const u2 = rng();
  const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const logAmount = Math.log(avgAmount * ((min + max) / 2)) + normal * 0.5;
  const amount = Math.exp(logAmount);
  return Math.round(Math.max(50, Math.min(amount, avgAmount * max * 2)));
}

const FAILURE_REASONS: Record<string, string[]> = {
  UPI: ["UPI_TIMEOUT", "UPI_BANK_DOWN", "UPI_LIMIT_EXCEEDED", "UPI_APP_ERROR", "UPI_DECLINED"],
  CARD: ["CARD_DECLINED", "INSUFFICIENT_FUNDS", "CARD_EXPIRED", "3DS_AUTH_FAILED", "GATEWAY_TIMEOUT"],
  NETBANKING: ["BANK_DOWN", "SESSION_EXPIRED", "AUTH_FAILED", "TRANSFER_LIMIT", "BANK_TIMEOUT"],
};

function generateFailureReason(method: string, isAnomaly: boolean, rng: () => number): string {
  const reasons = FAILURE_REASONS[method] || ["UNKNOWN"];
  if (isAnomaly && method === "UPI") {
    // During anomaly, more specific reasons
    const anomalyReasons = ["UPI_TIMEOUT", "UPI_BANK_DOWN", "UPI_APP_ERROR"];
    return anomalyReasons[Math.floor(rng() * anomalyReasons.length)];
  }
  return reasons[Math.floor(rng() * reasons.length)];
}

export function generateAllTransactions(seed: number = 42): Transaction[] {
  const rng = mulberry32(seed);
  const allTransactions: Transaction[] = [];
  const startDate = new Date("2025-01-06T00:00:00Z"); // Monday
  const numDays = 10;
  let txCounter = 0;

  for (const merchant of [MERCHANT_A, MERCHANT_B]) {
    for (let day = 0; day < numDays; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + day);
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      const dayStr = currentDate.toISOString().split("T")[0];

      for (let hour = 0; hour < 24; hour++) {
        const hourlyVol = generateHourlyVolume(hour, isWeekend, rng);
        const txCount = Math.round(hourlyVol * (merchant.dailyVolume / 24));

        for (let i = 0; i < txCount; i++) {
          const minute = Math.floor(rng() * 60);
          const second = Math.floor(rng() * 60);
          const ts = `${dayStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}Z`;

          // Payment method distribution
          const method = chooseWeighted(rng, ["UPI", "CARD", "NETBANKING"], [0.55, 0.30, 0.15]) as "UPI" | "CARD" | "NETBANKING";

          // Determine success rate
          let successRate = merchant.normalSuccessRates[method];
          let isAnomalyHour = false;

          if (
            merchant.id === ANOMALY.merchantId &&
            day === ANOMALY.dayOffset &&
            hour >= ANOMALY.startHour &&
            hour < ANOMALY.endHour &&
            method === ANOMALY.method
          ) {
            successRate = ANOMALY.degradedSuccessRate;
            isAnomalyHour = true;
          }

          const isSuccess = rng() < successRate;

          // Checkout behavior
          const checkoutStarted = true;
          const checkoutCompleted = isSuccess && rng() < merchant.checkoutConversion;

          // Amount
          const amount = generateAmount(method, merchant.avgAmount, rng);

          // Customer and device
          const customerType = rng() < 0.6 ? "returning" : "new";
          const deviceType = chooseWeighted(rng, ["mobile", "desktop", "tablet"], [0.65, 0.25, 0.10]) as "mobile" | "desktop" | "tablet";

          // Refund (only for successful transactions)
          let refundStatus: string | null = null;
          if (isSuccess && rng() < merchant.refundRate) {
            refundStatus = "processed";
          }

          const tx: Transaction = {
            transaction_id: `TXN_${String(txCounter++).padStart(6, "0")}`,
            merchant_id: merchant.id,
            merchant_name: merchant.name,
            timestamp: ts,
            amount,
            payment_method: method,
            payment_status: isSuccess ? "success" : "failed",
            failure_reason: isSuccess ? null : generateFailureReason(method, isAnomalyHour, rng),
            checkout_started: checkoutStarted,
            checkout_completed: checkoutCompleted,
            order_status: isSuccess ? (checkoutCompleted ? "completed" : "payment_captured") : "failed",
            refund_status: refundStatus,
            customer_type: customerType,
            device_type: deviceType,
          };

          allTransactions.push(tx);
        }
      }
    }
  }

  return allTransactions;
}

export { MERCHANT_A, MERCHANT_B, ANOMALY };
