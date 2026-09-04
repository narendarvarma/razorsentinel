import { NextResponse } from "next/server";
import { getAllDashboards } from "@/lib/data-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dashboards = getAllDashboards();
    const merchantA = dashboards.get("MERCH_A_001");

    if (!merchantA || id !== "INC_001") {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    const incident = {
      id: "INC_001",
      merchant_id: merchantA.merchantId,
      merchant_name: merchantA.merchantName,
      title: "Payment Conversion Degradation",
      severity: merchantA.anomaly.worst_metric?.severity || "NORMAL",
      detected_at: merchantA.anomalyHour,
      anomaly_start: merchantA.anomalyHour,
      anomaly_end: `${merchantA.anomalyDay}T17:00:00Z`,
      current_value: merchantA.anomaly.worst_metric?.current || 0,
      baseline_value: merchantA.anomaly.worst_metric?.rolling_mean || 0,
      z_score: merchantA.anomaly.worst_metric?.z_score || 0,
      deviation: merchantA.anomaly.worst_metric?.deviation || 0,
      root_causes: merchantA.rootCauses,
      financial_impact: merchantA.financialImpact,
      metrics: merchantA.anomaly.metrics,
      health_score: merchantA.healthScore,
      hourly_metrics: merchantA.hourlyMetrics,
      detection_latency_minutes: 15,
      affected_transactions: 0,
      timeline: [
        { step: 1, label: "Normal Operation", description: "Merchant operating within historical baseline", time: "Before 14:00" },
        { step: 2, label: "UPI Degradation", description: "UPI success rate drops below merchant baseline", time: "14:00" },
        { step: 3, label: "Payment Conversion Decline", description: "Overall payment success rate affected by UPI failure", time: "14:15" },
        { step: 4, label: "Revenue Anomaly", description: "Revenue deviation exceeds 2σ threshold", time: "14:30" },
        { step: 5, label: "Incident Detected", description: "RazorSentinel flags CRITICAL anomaly", time: "14:15-14:30" },
      ],
      isSyntheticData: true,
    };

    const anomalyHour = merchantA.anomalyHour;
    const metricsForHour = merchantA.hourlyMetrics.filter(
      (m) => m.hour >= anomalyHour && m.hour < `${merchantA.anomalyDay}T17:00:00Z`
    );
    incident.affected_transactions = metricsForHour.reduce((s, m) => s + m.failed_transactions, 0);

    return NextResponse.json(incident);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
