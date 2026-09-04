export interface AnalyticsContext {
  incident: string;
  current_success_rate: number;
  baseline_success_rate: number;
  z_score: number;
  root_cause: string;
  root_cause_confidence: number;
  daily_revenue_at_risk: number;
  seven_day_revenue_at_risk: number;
  merchant_name?: string;
  anomaly_hour?: string;
}

const SUPPORTED_QUESTION_PATTERNS = [
  { pattern: /why.*(revenue|drop|decline|decrease|fell)/i, type: "revenue_drop" },
  { pattern: /what.*(causing|cause|problem|issue|wrong)/i, type: "payment_problem" },
  { pattern: /how.*(much|revenue).*risk/i, type: "revenue_risk" },
  { pattern: /what.*happen.*today/i, type: "today_summary" },
  { pattern: /what.*(investigate|should.*do|action|recommend)/i, type: "investigate" },
  { pattern: /explain.*incident/i, type: "explain_incident" },
  { pattern: /what.*going.*wrong/i, type: "payment_problem" },
  { pattern: /why.*payment.*fail/i, type: "payment_problem" },
];

const SYSTEM_PROMPT = `You are an explanation assistant for RazorSentinel, a merchant early-warning system.
Use ONLY the supplied analytics context.
Never invent numbers.
Never calculate new financial values.
Never introduce unsupported facts.
If information is unavailable, explicitly say so.
Clearly distinguish observed values from MODEL ESTIMATES.
Keep explanations concise and actionable.
Do not add disclaimers about being an AI.`;

function generateTemplateExplanation(questionType: string, ctx: AnalyticsContext): string {
  const currentPct = (ctx.current_success_rate * 100).toFixed(1);
  const baselinePct = (ctx.baseline_success_rate * 100).toFixed(1);
  const dailyRisk = formatINR(ctx.daily_revenue_at_risk);
  const sevenDayRisk = formatINR(ctx.seven_day_revenue_at_risk);

  switch (questionType) {
    case "revenue_drop":
      return `Revenue dropped because payment success rate decreased from ${baselinePct}% to ${currentPct}%. The strongest contributing signal is ${ctx.root_cause}, with a computed confidence of ${ctx.root_cause_confidence}%. This caused fewer transactions to complete successfully, directly reducing captured revenue. Daily revenue at risk is ${dailyRisk} (MODEL ESTIMATE).`;

    case "payment_problem":
      return `The primary payment problem is ${ctx.root_cause} (confidence: ${ctx.root_cause_confidence}%). Payment success rate fell from ${baselinePct}% to ${currentPct}%, a deviation of ${(Math.abs(ctx.z_score)).toFixed(1)}σ from the merchant's historical baseline. This is a merchant-relative detection — the same rate might be normal for a different merchant.`;

    case "revenue_risk":
      return `Based on the detected anomaly, daily revenue at risk is ${dailyRisk} and 7-day projected risk is ${sevenDayRisk} (MODEL ESTIMATE). These are calculated as: baseline daily revenue × revenue deviation percentage. This is not a guaranteed loss — it represents the gap between current and baseline performance if the anomaly persists.`;

    case "today_summary":
      return `Today an anomaly was detected: ${ctx.incident}. Payment success rate is ${currentPct}% vs baseline ${baselinePct}%. The root cause is ${ctx.root_cause} (${ctx.root_cause_confidence}% confidence). Daily revenue at risk: ${dailyRisk} (MODEL ESTIMATE). Severity is based on a z-score of ${ctx.z_score.toFixed(1)} against this merchant's own historical baseline.`;

    case "investigate":
      return `Investigate: (1) ${ctx.root_cause} — this is the strongest signal at ${ctx.root_cause_confidence}% confidence. (2) Check UPI gateway/bank status for timeouts or outages. (3) Review recent changes to payment integration or merchant configuration. (4) Compare UPI failure reasons — during the anomaly, timeout and bank-down errors are elevated. (5) Monitor if the issue resolves after the anomaly window.`;

    case "explain_incident":
      return `Incident: ${ctx.incident}. This merchant's normal payment success rate is ${baselinePct}%. It has fallen to ${currentPct}%, a ${Math.abs(ctx.z_score).toFixed(1)}σ deviation (merchant-relative). Root cause: ${ctx.root_cause} (${ctx.root_cause_confidence}% confidence). Financial impact: ${dailyRisk}/day at risk, ${sevenDayRisk} over 7 days (MODEL ESTIMATE). The system detected this by comparing against the merchant's own rolling baseline, not a universal threshold.`;

    default:
      return `Payment success decreased from ${baselinePct}% to ${currentPct}%. The strongest contributing signal is ${ctx.root_cause}, with a computed confidence of ${ctx.root_cause_confidence}%.`;
  }
}

function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export async function getExplanation(question: string, ctx: AnalyticsContext): Promise<string> {
  // Check if question is supported
  const match = SUPPORTED_QUESTION_PATTERNS.find((p) => p.pattern.test(question));
  if (!match) {
    return `This question is outside the scope of RazorSentinel's current capabilities. Supported questions: (1) Why did revenue drop? (2) What is causing the payment problem? (3) How much revenue is at risk? (4) What happened today? (5) What should I investigate? (6) Explain this incident. All answers are based on computed analytics — the AI never invents numbers.`;
  }

  // Try LLM if API key is available
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Analytics context:\n${JSON.stringify(ctx, null, 2)}\n\nQuestion: ${question}`,
            },
          ],
          max_tokens: 300,
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || generateTemplateExplanation(match.type, ctx);
      }
    } catch {
      // Fall through to template
    }
  }

  // Offline fallback
  return generateTemplateExplanation(match.type, ctx);
}

export { generateTemplateExplanation, formatINR };
