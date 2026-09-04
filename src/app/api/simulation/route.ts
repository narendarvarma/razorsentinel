import { NextResponse } from "next/server";
import { getAllTransactions, getAllDashboards } from "@/lib/data-store";
import { runSimulation } from "@/lib/analytics";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { upi_success_rate } = body;

    if (typeof upi_success_rate !== "number" || upi_success_rate < 0 || upi_success_rate > 1) {
      return NextResponse.json(
        { error: "upi_success_rate must be a number between 0 and 1" },
        { status: 400 }
      );
    }

    const transactions = getAllTransactions();
    const dashboards = getAllDashboards();
    const merchantA = dashboards.get("MERCH_A_001");

    if (!merchantA) {
      return NextResponse.json({ error: "Merchant data not found" }, { status: 404 });
    }

    const result = runSimulation(
      transactions,
      merchantA.merchantId,
      merchantA.anomalyHour,
      upi_success_rate
    );

    return NextResponse.json({
      ...result,
      isSyntheticData: true,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
