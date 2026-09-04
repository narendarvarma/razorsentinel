"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

interface TimelineStep {
  step: number;
  label: string;
  description: string;
  time: string;
}

interface IncidentData {
  id: string;
  title: string;
  severity: string;
  detected_at: string;
  anomaly_start: string;
  anomaly_end: string;
  current_value: number;
  baseline_value: number;
  z_score: number;
  deviation: number;
  root_causes: RootCause[];
  financial_impact: FinancialImpact;
  metrics: BaselineResult[];
  health_score: { overall: number; payment_health: number; checkout_health: number; revenue_health: number; refund_health: number };
  timeline: TimelineStep[];
  detection_latency_minutes: number;
  affected_transactions: number;
}

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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-border shadow-sm ${className}`}>{children}</div>;
}

export default function IncidentDetail() {
  const [incident, setIncident] = useState<IncidentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    fetch("/api/incidents/INC_001")
      .then((r) => r.json())
      .then((d) => { setIncident(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer("");
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setAnswer(data.answer);
    } catch {
      setAnswer("Failed to get response. Please try again.");
    }
    setAsking(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!incident) return <div className="p-8 text-critical">Incident not found</div>;

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
          <button className="px-4 py-2.5 text-sm font-medium text-primary border-b-2 border-primary">Incident Detail</button>
          <Link href="/simulator" className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-navy border-b-2 border-transparent">What-If Simulator</Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Incident Header */}
        <Card className="p-6 border-l-4 border-l-critical">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-medium text-critical uppercase tracking-wider mb-1">INCIDENT DETAIL</p>
              <h2 className="text-2xl font-bold text-navy">{incident.title}</h2>
            </div>
            <span className={`px-4 py-1.5 rounded-md text-sm font-bold border ${severityColor(incident.severity)}`}>
              {incident.severity}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-text-muted">Detection Time</p>
              <p className="text-sm font-semibold">{incident.detected_at?.split("T")[1]?.substring(0, 5) || "14:00"}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Current</p>
              <p className="text-sm font-semibold text-critical">{fmtPct(incident.current_value)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Merchant Baseline</p>
              <p className="text-sm font-semibold text-success">{fmtPct(incident.baseline_value)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Z-Score</p>
              <p className="text-sm font-semibold text-critical">{incident.z_score.toFixed(2)}σ</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Deviation</p>
              <p className="text-sm font-semibold text-critical">{fmtPct(Math.abs(incident.deviation))}</p>
            </div>
          </div>

          {/* Demo Metrics */}
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-text-muted">Detection Latency</p>
              <p className="text-sm font-semibold">{incident.detection_latency_minutes} min</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Affected Transactions</p>
              <p className="text-sm font-semibold">{incident.affected_transactions}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Root Cause Confidence</p>
              <p className="text-sm font-semibold text-primary">{incident.root_causes[0]?.contribution || 0}%</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Revenue Flagged</p>
              <p className="text-sm font-semibold text-critical">{fmtINR(incident.financial_impact.daily_revenue_at_risk)}</p>
            </div>
          </div>
        </Card>

        {/* Timeline */}
        <Card className="p-6">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">INCIDENT TIMELINE</p>
          <div className="relative">
            {incident.timeline.map((step, i) => (
              <div key={i} className="flex gap-4 mb-4 last:mb-0">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === incident.timeline.length - 1 ? "bg-critical text-white" : "bg-primary/10 text-primary"
                  }`}>
                    {step.step}
                  </div>
                  {i < incident.timeline.length - 1 && <div className="w-0.5 h-8 bg-border" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy">{step.label}</p>
                  <p className="text-xs text-text-secondary">{step.description}</p>
                  <p className="text-xs text-text-muted mt-0.5">{step.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Root Cause Analysis */}
        <Card className="p-6">
          <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">ROOT CAUSE ANALYSIS</p>
          <p className="text-xs text-text-muted mb-4">Ranked by contribution score — calculated by analytics engine, not LLM</p>
          <div className="space-y-4">
            {incident.root_causes.map((rc, i) => (
              <div key={i} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <p className="text-sm font-semibold text-navy">{rc.cause}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${rc.contribution}%` }} />
                    </div>
                    <span className="text-sm font-bold text-primary">{rc.contribution}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 text-xs mt-2">
                  <div>
                    <p className="text-text-muted">Current</p>
                    <p className="font-medium text-critical">{fmtPct(rc.current_value)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Baseline</p>
                    <p className="font-medium text-text-secondary">{fmtPct(rc.baseline_value)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Deviation</p>
                    <p className="font-medium text-critical">{fmtPct(Math.abs(rc.deviation))}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Evidence</p>
                    <p className={`font-bold ${Math.abs(rc.evidence) >= 2 ? "text-critical" : "text-warning"}`}>
                      {rc.evidence.toFixed(2)}σ
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Financial Impact */}
        <Card className="p-6">
          <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">FINANCIAL IMPACT</p>
          <p className="text-xs text-text-muted italic mb-4">MODEL ESTIMATE — Not a guaranteed future loss</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-bg-light rounded-lg p-3">
              <p className="text-xs text-text-muted">Baseline Daily Revenue</p>
              <p className="text-lg font-bold text-navy">{fmtINR(incident.financial_impact.baseline_daily_revenue)}</p>
            </div>
            <div className="bg-bg-light rounded-lg p-3">
              <p className="text-xs text-text-muted">Current Daily Revenue</p>
              <p className="text-lg font-bold text-critical">{fmtINR(incident.financial_impact.current_daily_revenue)}</p>
            </div>
            <div className="bg-bg-light rounded-lg p-3">
              <p className="text-xs text-text-muted">Daily Revenue at Risk</p>
              <p className="text-lg font-bold text-critical">{fmtINR(incident.financial_impact.daily_revenue_at_risk)}</p>
            </div>
            <div className="bg-bg-light rounded-lg p-3">
              <p className="text-xs text-text-muted">7-Day Projected Risk</p>
              <p className="text-lg font-bold text-critical">{fmtINR(incident.financial_impact.seven_day_revenue_at_risk)}</p>
            </div>
          </div>

          {/* Traceability */}
          <div className="border border-border rounded-lg">
            <button
              className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-navy hover:bg-bg-light transition-colors"
              onClick={() => setExpandedTrace(expandedTrace === "revenue" ? null : "revenue")}
            >
              <span>🔍 How was &quot;Revenue at Risk&quot; calculated?</span>
              <span>{expandedTrace === "revenue" ? "▲" : "▼"}</span>
            </button>
            {expandedTrace === "revenue" && (
              <div className="px-4 pb-4 text-sm text-text-secondary space-y-2 border-t border-border pt-3">
                <p><strong>Formula:</strong> Daily Revenue at Risk = |min(0, Revenue Deviation)|</p>
                <p><strong>Step 1:</strong> Baseline daily revenue = {fmtINR(incident.financial_impact.baseline_daily_revenue)}</p>
                <p><strong>Step 2:</strong> Current daily revenue = {fmtINR(incident.financial_impact.current_daily_revenue)}</p>
                <p><strong>Step 3:</strong> Revenue deviation = {fmtINR(incident.financial_impact.revenue_deviation)} ({(incident.financial_impact.revenue_deviation_pct * 100).toFixed(1)}%)</p>
                <p><strong>Step 4:</strong> Daily revenue at risk = |min(0, {fmtINR(incident.financial_impact.revenue_deviation)})| = {fmtINR(incident.financial_impact.daily_revenue_at_risk)}</p>
                <p><strong>Step 5:</strong> 7-day projected = {fmtINR(incident.financial_impact.daily_revenue_at_risk)} × 7 = {fmtINR(incident.financial_impact.seven_day_revenue_at_risk)}</p>
                <p className="text-xs italic text-text-muted mt-2">This is a model estimate based on current deviation. It is not a guaranteed future loss.</p>
              </div>
            )}
          </div>
        </Card>

        {/* All Metric Deviations */}
        <Card className="p-6">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">ALL METRIC DEVIATIONS</p>
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
                {incident.metrics.map((m, i) => (
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

        {/* Recommended Action */}
        <Card className="p-6">
          <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">RECOMMENDED ACTION</p>
          <div className="space-y-2 text-sm text-text-secondary">
            <p>1. <strong>Investigate UPI gateway status</strong> — UPI success degradation is the strongest root cause ({incident.root_causes[0]?.contribution}% confidence).</p>
            <p>2. <strong>Check bank-side UPI availability</strong> — Timeout and bank-down errors are elevated during the anomaly window.</p>
            <p>3. <strong>Monitor merchant&apos;s payment integration</strong> — Verify no recent config changes or integration errors.</p>
            <p>4. <strong>Consider fallback routing</strong> — Route UPI payments through alternate gateways if primary is degraded.</p>
            <p>5. <strong>Track resolution</strong> — Monitor if the anomaly resolves after the anomaly window ({incident.anomaly_start?.split("T")[1]?.substring(0, 5)} – {incident.anomaly_end?.split("T")[1]?.substring(0, 5)}).</p>
          </div>
        </Card>

        {/* AI Assistant */}
        <Card className="p-6">
          <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">AI EXPLANATION</p>
          <p className="text-xs text-text-muted mb-4">Ask a supported question. The AI explains computed results — it never invents numbers.</p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="e.g., Why did revenue drop?"
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <button
              onClick={handleAsk}
              disabled={asking}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {asking ? "Thinking..." : "Ask"}
            </button>
          </div>

          {/* Suggested questions */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              "Why did revenue drop?",
              "What is causing the payment problem?",
              "How much revenue is at risk?",
              "What should I investigate?",
              "Explain this incident",
            ].map((q) => (
              <button
                key={q}
                onClick={() => { setQuestion(q); }}
                className="px-3 py-1 text-xs bg-bg-light text-text-secondary rounded-full border border-border hover:border-primary hover:text-primary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {answer && (
            <div className="bg-bg-light rounded-lg p-4 text-sm text-navy leading-relaxed border border-border">
              {answer}
            </div>
          )}
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
