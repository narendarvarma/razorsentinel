"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  AreaChart, Area,
} from "recharts";

// ============ TYPES ============
interface HealthScore {
  overall: number;
  payment_health: number;
  checkout_health: number;
  revenue_health: number;
  refund_health: number;
}

interface BaselineResult {
  metric: string;
  current: number;
  rolling_mean: number;
  rolling_std: number;
  z_score: number;
  severity: "NORMAL" | "WATCH" | "HIGH" | "CRITICAL";
  deviation: number;
}

interface RootCause {
  cause: string;
  contribution: number;
  current_value: number;
  baseline_value: number;
  deviation: number;
  evidence: number;
}

interface FinancialImpact {
  baseline_daily_revenue: number;
  current_daily_revenue: number;
  revenue_deviation: number;
  revenue_deviation_pct: number;
  daily_revenue_at_risk: number;
  seven_day_revenue_at_risk: number;
}

interface MerchantComparison {
  merchant_id: string;
  merchant_name: string;
  baseline: number;
  current: number;
  z_score: number;
  severity: string;
}

interface MerchantData {
  id: string;
  name: string;
  healthScore: HealthScore;
  totalRevenue: number;
  totalTransactions: number;
  paymentSuccessRate: number;
  checkoutConversion: number;
  refundRate: number;
  anomaly?: {
    is_anomaly: boolean;
    metrics: BaselineResult[];
    worst_metric: BaselineResult | null;
    anomaly_hours: string[];
  };
  financialImpact?: FinancialImpact;
  rootCauses?: RootCause[];
  anomalyHour?: string;
  anomalyDay?: string;
  hourlyMetrics?: {
    hour: string;
    overall_success_rate: number;
    upi_success_rate: number;
    revenue: number;
    total_transactions: number;
  }[];
}

// ============ HELPERS ============
function fmtINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function severityColor(s: string) {
  switch (s) {
    case "CRITICAL": return "text-critical bg-critical-light border-critical/30";
    case "HIGH": return "text-critical bg-critical-light border-critical/30";
    case "WATCH": return "text-warning bg-warning-light border-warning/30";
    default: return "text-success bg-success-light border-success/30";
  }
}

function healthColor(score: number) {
  if (score >= 90) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-critical";
}

function healthBarColor(score: number) {
  if (score >= 90) return "bg-success";
  if (score >= 70) return "bg-warning";
  return "bg-critical";
}

// ============ COMPONENTS ============

function Badge({ children, variant = "info" }: { children: React.ReactNode; variant?: "info" | "warning" | "success" }) {
  const styles = {
    info: "bg-primary/10 text-primary border-primary/20",
    warning: "bg-warning-light text-warning border-warning/30",
    success: "bg-success-light text-success border-success/30",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${styles[variant]}`}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-border shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function MetricCard({ label, value, subtitle, trend, trendLabel }: {
  label: string; value: string; subtitle?: string;
  trend?: "up" | "down" | "neutral"; trendLabel?: string;
}) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-critical" : "text-text-muted";
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-navy">{value}</p>
      {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
      {trendLabel && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trendColor}`}>
          <span>{trendIcon}</span>
          <span>{trendLabel}</span>
        </div>
      )}
    </Card>
  );
}

function HealthScoreCard({ health }: { health: HealthScore }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">Merchant Health</p>
      <div className="flex items-center gap-4">
        <div className={`text-4xl font-bold ${healthColor(health.overall)}`}>
          {Math.round(health.overall)}
        </div>
        <div className="text-sm text-text-muted">/100</div>
      </div>
      <div className="mt-4 space-y-2">
        {[
          { label: "Payment", value: health.payment_health, weight: "35%" },
          { label: "Checkout", value: health.checkout_health, weight: "25%" },
          { label: "Revenue", value: health.revenue_health, weight: "25%" },
          { label: "Refund", value: health.refund_health, weight: "15%" },
        ].map(({ label, value, weight }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">{label} <span className="text-text-muted">({weight})</span></span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${healthBarColor(value)}`}
                  style={{ width: `${Math.min(100, value)}%` }}
                />
              </div>
              <span className={`font-medium ${healthColor(value)}`}>{Math.round(value)}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function IncidentCard({ anomaly, financialImpact, anomalyHour }: {
  anomaly: { worst_metric: BaselineResult | null; is_anomaly: boolean };
  financialImpact: FinancialImpact;
  anomalyHour: string;
}) {
  if (!anomaly.is_anomaly || !anomaly.worst_metric) return null;
  const wm = anomaly.worst_metric;
  return (
    <Card className="p-5 border-l-4 border-l-critical">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-critical uppercase tracking-wider mb-1">🚨 AI Detected Incident</p>
          <p className="text-lg font-bold text-navy">Payment Conversion Degradation</p>
        </div>
        <span className={`px-3 py-1 rounded-md text-xs font-bold border ${severityColor(wm.severity)}`}>
          {wm.severity}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-text-muted">Started</p>
          <p className="text-sm font-semibold">{anomalyHour?.split("T")[1]?.substring(0, 5) || "14:00"}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Current</p>
          <p className="text-sm font-semibold text-critical">{fmtPct(wm.current)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Baseline</p>
          <p className="text-sm font-semibold text-success">{fmtPct(wm.rolling_mean)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Z-Score</p>
          <p className="text-sm font-semibold text-critical">{wm.z_score.toFixed(1)}σ</p>
        </div>
      </div>
      <div className="flex items-center justify-between bg-critical-light/50 rounded-lg p-3 mb-3">
        <div>
          <p className="text-xs text-text-muted">REVENUE AT RISK</p>
          <p className="text-xl font-bold text-critical">{fmtINR(financialImpact.daily_revenue_at_risk)}</p>
          <p className="text-xs text-text-muted italic">MODEL ESTIMATE</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">7-DAY PROJECTED</p>
          <p className="text-lg font-bold text-critical">{fmtINR(financialImpact.seven_day_revenue_at_risk)}</p>
          <p className="text-xs text-text-muted italic">MODEL ESTIMATE</p>
        </div>
      </div>
      <div className="flex gap-3">
        <Link href="/incident" className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors">
          Investigate
        </Link>
        <Link href="/simulator" className="px-4 py-2 bg-white text-primary text-sm font-medium rounded-lg border border-primary hover:bg-primary/5 transition-colors">
          What-If Simulator
        </Link>
      </div>
    </Card>
  );
}

function MerchantComparisonSection({ comparisons }: { comparisons: MerchantComparison[] }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">WHY MERCHANT-RELATIVE?</p>
      <p className="text-sm text-text-secondary mb-4">
        The same raw metric produces different severity depending on the merchant&apos;s historical behavior.
      </p>
      <p className="text-xs text-text-muted mb-3">Example: Both merchants at 91% payment success</p>
      <div className="grid grid-cols-2 gap-4">
        {comparisons.map((c) => (
          <div key={c.merchant_id} className="border border-border rounded-lg p-4">
            <p className="text-sm font-semibold text-navy mb-2">{c.merchant_name}</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Baseline:</span>
                <span className="font-medium">{fmtPct(c.baseline)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Current:</span>
                <span className="font-medium">91.0%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Z-Score:</span>
                <span className={`font-bold ${c.severity === "CRITICAL" || c.severity === "HIGH" ? "text-critical" : "text-success"}`}>
                  {c.z_score.toFixed(1)}σ
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Severity:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-xs ${severityColor(c.severity)}`}>
                  {c.severity}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RootCausePreview({ causes }: { causes: RootCause[] }) {
  if (!causes || causes.length === 0) return null;
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">ROOT CAUSE ANALYSIS</p>
      <div className="space-y-3">
        {causes.slice(0, 3).map((c, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-navy">{c.cause}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${c.contribution}%` }} />
                </div>
                <span className="text-xs font-semibold text-primary">{c.contribution}%</span>
              </div>
            </div>
            <span className="text-xs text-critical font-medium">{c.evidence.toFixed(1)}σ</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============ MAIN DASHBOARD ============

export default function Dashboard() {
  const [data, setData] = useState<{
    merchants: { MERCH_A: MerchantData; MERCH_B: MerchantData };
    merchantComparison: MerchantComparison[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-secondary">Loading analytics engine...</p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-critical">Failed to load data</div>;

  const mA = data.merchants.MERCH_A;

  // Prepare chart data from hourly metrics
  const chartData = (mA.hourlyMetrics || []).map((m) => ({
    time: m.hour.substring(5, 16).replace("T", " "),
    paymentSuccess: Math.round(m.overall_success_rate * 1000) / 10,
    upiSuccess: Math.round(m.upi_success_rate * 1000) / 10,
    revenue: m.revenue,
    transactions: m.total_transactions,
  }));

  // Find anomaly index for chart reference line
  const anomalyTime = mA.anomalyHour?.substring(5, 16).replace("T", " ");

  return (
    <div className="min-h-screen bg-bg-light">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">RS</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-navy leading-tight">RazorSentinel</h1>
                <p className="text-xs text-text-secondary">AI Merchant Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="warning">INDEPENDENT OPEN TRACK PROTOTYPE</Badge>
              <Badge variant="info">SYNTHETIC DEMO DATA</Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            <button className="px-4 py-2.5 text-sm font-medium text-primary border-b-2 border-primary">
              Dashboard
            </button>
            <Link href="/incident" className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-navy border-b-2 border-transparent hover:border-border transition-colors">
              Incident Detail
            </Link>
            <Link href="/simulator" className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-navy border-b-2 border-transparent hover:border-border transition-colors">
              What-If Simulator
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Merchant Selector */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-navy">{mA.name}</h2>
            <p className="text-sm text-text-secondary">{mA.id}</p>
          </div>
          <Badge variant="success">Active Monitoring</Badge>
        </div>

        {/* Top Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <HealthScoreCard health={mA.healthScore} />
          <MetricCard
            label="Total Revenue"
            value={fmtINR(mA.totalRevenue)}
            subtitle="All captured payments"
          />
          <MetricCard
            label="Transactions"
            value={mA.totalTransactions.toLocaleString()}
            subtitle="Total processed"
          />
          <MetricCard
            label="Payment Success"
            value={fmtPct(mA.paymentSuccessRate)}
            trend={mA.anomaly?.is_anomaly ? "down" : "neutral"}
            trendLabel={mA.anomaly?.is_anomaly ? "Anomaly detected" : "Within baseline"}
          />
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Checkout Conversion"
            value={fmtPct(mA.checkoutConversion)}
          />
          <MetricCard
            label="Refund Rate"
            value={fmtPct(mA.refundRate)}
          />
          <MetricCard
            label="Daily Revenue at Risk"
            value={fmtINR(mA.financialImpact?.daily_revenue_at_risk || 0)}
            subtitle="MODEL ESTIMATE"
            trend={mA.financialImpact?.daily_revenue_at_risk ? "down" : "neutral"}
            trendLabel={mA.financialImpact?.daily_revenue_at_risk ? "Anomaly impact" : "No anomaly"}
          />
          <MetricCard
            label="7-Day Projected Risk"
            value={fmtINR(mA.financialImpact?.seven_day_revenue_at_risk || 0)}
            subtitle="MODEL ESTIMATE"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">Payment Success Rate (Hourly)</p>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2B84EA" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2B84EA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94A3B8" }} interval={23} />
                <YAxis domain={[80, 100]} tick={{ fontSize: 10, fill: "#94A3B8" }} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E5EAF0" }} formatter={(v: unknown) => `${v}%`} />
                {anomalyTime && <ReferenceLine x={anomalyTime} stroke="#EF4444" strokeDasharray="4 4" label={{ value: "Anomaly", fontSize: 10, fill: "#EF4444" }} />}
                <Area type="monotone" dataKey="paymentSuccess" stroke="#2B84EA" fill="url(#successGrad)" strokeWidth={2} name="Overall" />
                <Area type="monotone" dataKey="upiSuccess" stroke="#F59E0B" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="UPI" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">Hourly Revenue</p>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94A3B8" }} interval={23} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} tickFormatter={(v: number) => v >= 1000000 ? `₹${(v/1000000).toFixed(1)}M` : `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E5EAF0" }} formatter={(v: unknown) => `₹${Number(v).toLocaleString("en-IN")}`} />
                {anomalyTime && <ReferenceLine x={anomalyTime} stroke="#EF4444" strokeDasharray="4 4" label={{ value: "Anomaly", fontSize: 10, fill: "#EF4444" }} />}
                <Area type="monotone" dataKey="revenue" stroke="#10B981" fill="url(#revenueGrad)" strokeWidth={2} name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Incident Alert */}
        {mA.anomaly?.is_anomaly && mA.financialImpact && (
          <IncidentCard
            anomaly={mA.anomaly}
            financialImpact={mA.financialImpact}
            anomalyHour={mA.anomalyHour || ""}
          />
        )}

        {/* Root Cause & Merchant Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {mA.rootCauses && <RootCausePreview causes={mA.rootCauses} />}
          {data.merchantComparison && <MerchantComparisonSection comparisons={data.merchantComparison} />}
        </div>

        {/* Anomaly Metrics Detail */}
        {mA.anomaly?.metrics && mA.anomaly.metrics.length > 0 && (
          <Card className="p-5">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
              All Metric Deviations (Merchant-Relative)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-text-muted font-medium">Metric</th>
                    <th className="text-right py-2 text-xs text-text-muted font-medium">Current</th>
                    <th className="text-right py-2 text-xs text-text-muted font-medium">Baseline</th>
                    <th className="text-right py-2 text-xs text-text-muted font-medium">Deviation</th>
                    <th className="text-right py-2 text-xs text-text-muted font-medium">Z-Score</th>
                    <th className="text-center py-2 text-xs text-text-muted font-medium">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {mA.anomaly.metrics.map((m, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 font-medium text-navy">{m.metric}</td>
                      <td className="py-2 text-right">{m.metric.includes("Revenue") ? fmtINR(m.current) : fmtPct(m.current)}</td>
                      <td className="py-2 text-right text-text-secondary">{m.metric.includes("Revenue") ? fmtINR(m.rolling_mean) : fmtPct(m.rolling_mean)}</td>
                      <td className="py-2 text-right">{m.metric.includes("Revenue") ? fmtINR(m.deviation) : fmtPct(Math.abs(m.deviation))}</td>
                      <td className={`py-2 text-right font-semibold ${Math.abs(m.z_score) >= 2 ? "text-critical" : Math.abs(m.z_score) >= 1 ? "text-warning" : "text-text-secondary"}`}>
                        {m.z_score.toFixed(2)}σ
                      </td>
                      <td className="py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${severityColor(m.severity)}`}>
                          {m.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-4 text-xs text-text-muted border-t border-border">
          <p className="font-medium">RazorSentinel — AI-Powered Merchant Early-Warning &amp; What-If Intelligence</p>
          <p className="mt-1">This is an independent prototype created for the Razorpay Open Track. It is not an official Razorpay product.</p>
          <p className="mt-1">All data is synthetic. No real customer data is used.</p>
        </div>
      </main>
    </div>
  );
}
