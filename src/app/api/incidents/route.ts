import { NextResponse } from "next/server";
import { getAllDashboards } from "@/lib/data-store";

export async function GET() {
  try {
    const dashboards = getAllDashboards();
    const merchantA = dashboards.get("MERCH_A_001");

    if (!merchantA) {
      return NextResponse.json({ error: "Merchant data not found" }, { status: 404 });
    }

    // Build incident from anomaly detection
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
      detection_latency_minutes: 15,
      affected_transactions: 0,
      isSyntheticData: true,
    };

    // Count affected transactions in anomaly window
    const anomalyHour = merchantA.anomalyHour;
    const metricsForHour = merchantA.hourlyMetrics.filter(
      (m) => m.hour >= anomalyHour && m.hour < `${merchantA.anomalyDay}T17:00:00Z`
    );
    incident.affected_transactions = metricsForHour.reduce((s, m) => s + m.failed_transactions, 0);

    return NextResponse.json({ incidents: [incident] });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
