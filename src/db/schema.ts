import { pgTable, uuid, varchar, timestamp, numeric, boolean, text, index } from "drizzle-orm/pg-core";

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: varchar("transaction_id", { length: 32 }).notNull(),
    merchantId: varchar("merchant_id", { length: 32 }).notNull(),
    merchantName: varchar("merchant_name", { length: 128 }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 16 }).notNull(),
    paymentStatus: varchar("payment_status", { length: 16 }).notNull(),
    failureReason: varchar("failure_reason", { length: 64 }),
    checkoutStarted: boolean("checkout_started").notNull().default(true),
    checkoutCompleted: boolean("checkout_completed").notNull().default(false),
    orderStatus: varchar("order_status", { length: 16 }),
    refundStatus: varchar("refund_status", { length: 16 }),
    customerType: varchar("customer_type", { length: 16 }).notNull(),
    deviceType: varchar("device_type", { length: 16 }).notNull(),
  },
  (table) => [
    index("idx_transactions_merchant").on(table.merchantId),
    index("idx_transactions_timestamp").on(table.timestamp),
    index("idx_transactions_method").on(table.paymentMethod),
  ]
);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: varchar("incident_id", { length: 32 }).notNull(),
    merchantId: varchar("merchant_id", { length: 32 }).notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    severity: varchar("severity", { length: 16 }).notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    anomalyStart: timestamp("anomaly_start", { withTimezone: true }).notNull(),
    anomalyEnd: timestamp("anomaly_end", { withTimezone: true }).notNull(),
    currentValue: numeric("current_value", { precision: 8, scale: 4 }).notNull(),
    baselineValue: numeric("baseline_value", { precision: 8, scale: 4 }).notNull(),
    zScore: numeric("z_score", { precision: 8, scale: 4 }).notNull(),
    rootCause: text("root_cause"),
    rootCauseConfidence: numeric("root_cause_confidence", { precision: 5, scale: 2 }),
    dailyRevenueAtRisk: numeric("daily_revenue_at_risk", { precision: 14, scale: 2 }),
    sevenDayRevenueAtRisk: numeric("seven_day_revenue_at_risk", { precision: 14, scale: 2 }),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    analytics: text("analytics"),
  }
);
