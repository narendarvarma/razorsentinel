import { NextResponse } from "next/server";
import { getExplanation, type AnalyticsContext } from "@/lib/llm-explanation";
import { getAllDashboards } from "@/lib/data-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const dashboards = getAllDashboards();
    const merchantA = dashboards.get("MERCH_A_001");

    if (!merchantA) {
      return NextResponse.json({ error: "Merchant data not found" }, { status: 404 });
    }

    const ctx: AnalyticsContext = {
      incident: "Payment conversion degradation",
      current_success_rate: merchantA.anomaly.worst_metric?.current || merchantA.paymentSuccessRate,
      baseline_success_rate: merchantA.anomaly.worst_metric?.rolling_mean || 0.96,
      z_score: merchantA.anomaly.worst_metric?.z_score || 0,
      root_cause: merchantA.rootCauses[0]?.cause || "Unknown",
      root_cause_confidence: merchantA.rootCauses[0]?.contribution || 0,
      daily_revenue_at_risk: merchantA.financialImpact.daily_revenue_at_risk,
      seven_day_revenue_at_risk: merchantA.financialImpact.seven_day_revenue_at_risk,
      merchant_name: merchantA.merchantName,
      anomaly_hour: merchantA.anomalyHour,
    };

    const answer = await getExplanation(question, ctx);

    return NextResponse.json({
      question,
      answer,
      context_used: ctx,
      isSyntheticData: true,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
