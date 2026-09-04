"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface SimResult {
  upi_success_rate: number;
  successful_transactions: number;
  failed_transactions: number;
  revenue: number;
  revenue_at_risk: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

function fmtINR(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function riskColor(level: string) {
  switch (level) {
    case "CRITICAL": return "text-critical";
    case "HIGH": return "text-critical";
    case "MEDIUM": return "text-warning";
    default: return "text-success";
  }
}

function riskBg(level: string) {
  switch (level) {
    case "CRITICAL": return "bg-critical-light border-critical/30";
    case "HIGH": return "bg-critical-light border-critical/30";
    case "MEDIUM": return "bg-warning-light border-warning/30";
    default: return "bg-success-light border-success/30";
  }
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-border shadow-sm ${className}`}>{children}</div>;
}

export default function Simulator() {
  const [currentUpiRate, setCurrentUpiRate] = useState(0);
  const [simulatedRate, setSimulatedRate] = useState(92);
  const [currentResult, setCurrentResult] = useState<SimResult | null>(null);
  const [simulatedResult, setSimulatedResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrent = useCallback(async () => {
    try {
      // Get current state by simulating with the current rate
      const res = await fetch("/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upi_success_rate: 0.96 }), // normal rate
      });
      const data = await res.json();
      setCurrentResult(data.current);
      setCurrentUpiRate(data.current.upi_success_rate * 100);
      setSimulatedRate(Math.round(data.current.upi_success_rate * 100));
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrent();
  }, [fetchCurrent]);

  const runSimulation = useCallback(async (rate: number) => {
    try {
      const res = await fetch("/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upi_success_rate: rate / 100 }),
      });
      const data = await res.json();
      setSimulatedResult(data.simulated);
      if (!currentResult) {
        setCurrentResult(data.current);
        setCurrentUpiRate(data.current.upi_success_rate * 100);
      }
    } catch {
      // ignore
    }
  }, [currentResult]);

  useEffect(() => {
    if (!loading) {
      runSimulation(simulatedRate);
    }
  }, [simulatedRate, loading, runSimulation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const chartData = currentResult && simulatedResult ? [
    {
      name: "Successful",
      Current: currentResult.successful_transactions,
      Simulated: simulatedResult.successful_transactions,
    },
    {
      name: "Failed",
      Current: currentResult.failed_transactions,
      Simulated: simulatedResult.failed_transactions,
    },
    {
      name: "Revenue (₹K)",
      Current: Math.round(currentResult.revenue / 1000),
      Simulated: Math.round(simulatedResult.revenue / 1000),
    },
  ] : [];

  const rateDiff = simulatedRate - currentUpiRate;

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
                <h1 className="text-lg font-bold text-navy">RazorSentinel</h1>
                <p className="text-xs text-text-secondary">AI Merchant Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border bg-warning-light text-warning border-warning/30">
                INDEPENDENT OPEN TRACK PROTOTYPE
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border bg-primary/10 text-primary border-primary/20">
                SYNTHETIC DEMO DATA
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          <Link href="/" className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-navy border-b-2 border-transparent">Dashboard</Link>
          <Link href="/incident" className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-navy border-b-2 border-transparent">Incident Detail</Link>
          <button className="px-4 py-2.5 text-sm font-medium text-primary border-b-2 border-primary">What-If Simulator</button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Title */}
        <div>
          <h2 className="text-2xl font-bold text-navy">What-If Simulator</h2>
          <p className="text-sm text-text-secondary mt-1">What happens if payment performance changes?</p>
        </div>

        {/* Slider Control */}
        <Card className="p-6">
          <p className="text-xs font-medium text-primary uppercase tracking-wider mb-4">SIMULATION PARAMETER</p>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-navy">UPI Success Rate</label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">{simulatedRate}%</span>
                {rateDiff !== 0 && (
                  <span className={`text-sm font-medium ${rateDiff < 0 ? "text-critical" : "text-success"}`}>
                    ({rateDiff > 0 ? "+" : ""}{rateDiff.toFixed(0)}pp)
                  </span>
                )}
              </div>
            </div>
            <input
              type="range"
              min={80}
              max={100}
              value={simulatedRate}
              onChange={(e) => setSimulatedRate(Number(e.target.value))}
              className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              <span>80%</span>
              <span>85%</span>
              <span>90%</span>
              <span>95%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Current vs Simulated Indicator */}
          <div className="flex items-center gap-4 p-3 bg-bg-light rounded-lg">
            <div className="flex-1 text-center">
              <p className="text-xs text-text-muted mb-1">CURRENT</p>
              <p className="text-lg font-bold text-navy">{currentUpiRate.toFixed(1)}%</p>
            </div>
            <div className="text-text-muted">→</div>
            <div className="flex-1 text-center">
              <p className="text-xs text-text-muted mb-1">SIMULATED</p>
              <p className={`text-lg font-bold ${rateDiff < 0 ? "text-critical" : rateDiff > 0 ? "text-success" : "text-navy"}`}>
                {simulatedRate}%
              </p>
            </div>
          </div>
        </Card>

        {/* Results Grid */}
        {currentResult && simulatedResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Successful Transactions */}
            <Card className="p-5">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Successful Transactions</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-text-muted">Current</p>
                  <p className="text-2xl font-bold text-navy">{currentResult.successful_transactions}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-muted">Simulated</p>
                  <p className={`text-2xl font-bold ${simulatedResult.successful_transactions < currentResult.successful_transactions ? "text-critical" : "text-success"}`}>
                    {simulatedResult.successful_transactions}
                  </p>
                </div>
              </div>
              <div className="mt-2 text-xs text-text-muted">
                Δ = {simulatedResult.successful_transactions - currentResult.successful_transactions}
              </div>
            </Card>

            {/* Failed Transactions */}
            <Card className="p-5">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Failed Transactions</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-text-muted">Current</p>
                  <p className="text-2xl font-bold text-navy">{currentResult.failed_transactions}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-muted">Simulated</p>
                  <p className={`text-2xl font-bold ${simulatedResult.failed_transactions > currentResult.failed_transactions ? "text-critical" : "text-success"}`}>
                    {simulatedResult.failed_transactions}
                  </p>
                </div>
              </div>
              <div className="mt-2 text-xs text-text-muted">
                Δ = {simulatedResult.failed_transactions - currentResult.failed_transactions}
              </div>
            </Card>

            {/* Revenue */}
            <Card className="p-5">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Revenue</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-text-muted">Current</p>
                  <p className="text-2xl font-bold text-navy">{fmtINR(currentResult.revenue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-muted">Simulated</p>
                  <p className={`text-2xl font-bold ${simulatedResult.revenue < currentResult.revenue ? "text-critical" : "text-success"}`}>
                    {fmtINR(simulatedResult.revenue)}
                  </p>
                </div>
              </div>
            </Card>

            {/* Revenue at Risk + Risk Level */}
            <Card className="p-5">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">Revenue at Risk</p>
              <p className={`text-3xl font-bold ${simulatedResult.revenue_at_risk > 0 ? "text-critical" : "text-success"}`}>
                {fmtINR(simulatedResult.revenue_at_risk)}
              </p>
              <p className="text-xs text-text-muted italic mt-1">MODEL ESTIMATE</p>
              <div className="mt-3">
                <p className="text-xs text-text-muted mb-1">Risk Level</p>
                <span className={`px-3 py-1 rounded-md text-sm font-bold border ${riskBg(simulatedResult.risk_level)} ${riskColor(simulatedResult.risk_level)}`}>
                  {simulatedResult.risk_level}
                </span>
              </div>
            </Card>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <Card className="p-6">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">CURRENT vs SIMULATED</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5EAF0" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#E5EAF0" />
                <Bar dataKey="Current" fill="#2B84EA" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Simulated" fill={simulatedRate < currentUpiRate ? "#EF4444" : "#10B981"} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Calculation Traceability */}
        <Card className="p-6">
          <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">HOW IS THIS CALCULATED?</p>
          <p className="text-xs text-text-muted mb-4">The simulation uses real transaction data, not synthetic projections.</p>
          <div className="space-y-2 text-sm text-text-secondary">
            <p><strong>1.</strong> Take all UPI transactions in the anomaly hour from the real dataset.</p>
            <p><strong>2.</strong> Recalculate: successful = round(total_upi × simulated_rate)</p>
            <p><strong>3.</strong> Recalculate: failed = total_upi - successful</p>
            <p><strong>4.</strong> Recalculate revenue using average UPI transaction amount × new successful count</p>
            <p><strong>5.</strong> Revenue at risk = max(0, current_revenue - simulated_revenue)</p>
            <p><strong>6.</strong> Risk level based on simulated overall success rate thresholds</p>
          </div>
          <p className="text-xs italic text-text-muted mt-3">
            All values are dynamically recalculated when the slider moves. No values are hardcoded.
          </p>
        </Card>

        {/* Footer */}
        <div className="text-center py-4 text-xs text-text-muted border-t border-border">
          <p className="font-medium">RazorSentinel — AI-Powered Merchant Early-Warning & What-If Intelligence</p>
          <p className="mt-1">This is an independent prototype created for the Razorpay Open Track. It is not an official Razorpay product.</p>
        </div>
      </main>
    </div>
  );
}
