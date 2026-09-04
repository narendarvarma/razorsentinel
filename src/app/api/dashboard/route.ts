import { NextResponse } from "next/server";
import { getAllDashboards } from "@/lib/data-store";
import { merchantRelativeComparison } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dashboards = getAllDashboards();
    const merchantA = dashboards.get("MERCH_A_001");
    const merchantB = dashboards.get("MERCH_B_001");

    if (!merchantA || !merchantB) {
      return NextResponse.json({ error: "Merchant data not found" }, { status: 404 });
    }

    // Merchant comparison for "Why Merchant-Relative?" section
    const comparisonCurrentRate = 0.91; // Example: both at 91%
    const comparison = merchantRelativeComparison(
      merchantA.hourlyMetrics.concat(merchantB.hourlyMetrics),
      comparisonCurrentRate
    );

    return NextResponse.json({
      merchants: {
        MERCH_A: {
          id: merchantA.merchantId,
          name: merchantA.merchantName,
          healthScore: merchantA.healthScore,
          totalRevenue: merchantA.totalRevenue,
          totalTransactions: merchantA.totalTransactions,
          paymentSuccessRate: merchantA.paymentSuccessRate,
          checkoutConversion: merchantA.checkoutConversion,
          refundRate: merchantA.refundRate,
          anomaly: merchantA.anomaly,
          financialImpact: merchantA.financialImpact,
          rootCauses: merchantA.rootCauses,
          anomalyHour: merchantA.anomalyHour,
          anomalyDay: merchantA.anomalyDay,
        },
        MERCH_B: {
          id: merchantB.merchantId,
          name: merchantB.merchantName,
          healthScore: merchantB.healthScore,
          totalRevenue: merchantB.totalRevenue,
          totalTransactions: merchantB.totalTransactions,
          paymentSuccessRate: merchantB.paymentSuccessRate,
          checkoutConversion: merchantB.checkoutConversion,
          refundRate: merchantB.refundRate,
        },
      },
      merchantComparison: comparison,
      isSyntheticData: true,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
