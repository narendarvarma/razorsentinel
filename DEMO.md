# RazorSentinel Demo Script

> **3-5 minute live demo**

---

## Pre-Demo Setup

1. Start the application: `npm start`
2. Open http://localhost:3000
3. Verify the dashboard loads with synthetic data

---

## STEP 1: Show Healthy Merchant Dashboard (30 seconds)

**Navigate to**: Dashboard (/)

**Show**:
- Merchant Health score
- Total Revenue and Transaction count
- Payment Success Rate
- The "SYNTHETIC DEMO DATA" and "INDEPENDENT OPEN TRACK PROTOTYPE" badges

**Say**: "This is RazorSentinel, a merchant early-warning system. We're looking at ShopPrime Electronics, an e-commerce merchant. The dashboard shows key metrics and health scores."

---

## STEP 2: Show Payment Conversion Degradation (45 seconds)

**Point to**: The incident card on the dashboard

**Show**:
- 🚨 AI DETECTED INCIDENT
- Severity: CRITICAL
- Current vs Baseline payment success rate
- Z-score (e.g., -18.71σ)
- Revenue at risk (MODEL ESTIMATE)

**Say**: "The system has detected a CRITICAL anomaly. Payment success has degraded significantly. Notice the z-score — this is a massive deviation from the merchant's normal behavior."

---

## STEP 3: Show Merchant-Relative Baseline (45 seconds)

**Point to**: "WHY MERCHANT-RELATIVE?" section

**Show**:
- Merchant A: Baseline 98%, Current 91%, Z-score = CRITICAL
- Merchant B: Baseline 92%, Current 91%, Z-score = NORMAL

**Say**: "This is our core differentiator. We don't use a universal threshold. We compare the merchant against its own historical behavior. Both merchants are at 91% success — but for Merchant A, that's a CRITICAL anomaly. For Merchant B, it's completely normal."

---

## STEP 4: Open Root Cause Analysis (45 seconds)

**Navigate to**: Click "Investigate" → Incident Detail page

**Show**:
- Incident timeline (Normal → UPI degradation → Payment decline → Revenue anomaly → Incident detected)
- Root Cause Analysis ranking
  1. UPI Success Degradation (81% contribution, -18.71σ)
  2. Checkout Conversion Decline (17% contribution)
- Each cause shows Current, Baseline, Deviation, Evidence

**Say**: "The root cause analysis identifies UPI success degradation as the strongest contributor at 81% confidence. The contribution score is calculated from z-score magnitudes — the LLM did not generate this number. The analytics engine calculated it."

---

## STEP 5: Show Financial Impact (30 seconds)

**Point to**: Financial Impact section

**Show**:
- Baseline daily revenue
- Daily revenue at risk
- 7-day projected risk
- "MODEL ESTIMATE" label

**Click**: "How was this calculated?" expandable

**Show**: The step-by-step calculation traceability

**Say**: "Every financial value has a 'How was this calculated?' traceability section. The LLM did not generate this number. The analytics engine calculated it. This is a model estimate, not a guaranteed loss."

---

## STEP 6: Open What-If Simulator (45 seconds)

**Navigate to**: Click "What-If Simulator" → /simulator

**Show**:
- Current UPI success rate
- The slider control

**Action**: Move the UPI success rate slider down by 10% (e.g., from ~82% to ~75%)

**Show**:
- CURRENT vs SIMULATED comparison
- Updated revenue, revenue at risk, risk level
- The chart updating dynamically

**Say**: "The what-if simulator lets us explore scenarios. If UPI success drops further to 75%, we can see the projected impact on revenue and risk level. All values are dynamically recalculated using real transaction data — no fake numbers."

---

## STEP 7: Ask AI Explanation (30 seconds)

**Navigate to**: Back to Incident Detail (/incident)

**In the AI EXPLANATION section**, type: "Why did revenue drop?"

**Show**: The AI's response, which references the computed analytics values

**Say**: "The AI explains the result using only the pre-computed analytics context. It never invents numbers or calculates new financial values."

---

## STEP 8: Test Hallucination Guard (20 seconds)

**In the AI EXPLANATION section**, type: "What is the weather today?"

**Show**: The response explaining supported capabilities and refusing to answer

**Say**: "The assistant only answers supported questions about the detected anomaly. It won't hallucinate or invent information outside its scope."

---

## Key Takeaways

1. **Merchant-relative baselines** — not universal thresholds
2. **Transparent analytics** — every number is computed, not generated
3. **Root cause with evidence** — z-scores and contribution scores, not black-box
4. **Financial traceability** — "How was this calculated?" for every value
5. **What-if intelligence** — real simulation, not fake buttons
6. **LLM as explanation layer** — never computes, only explains

---

*RazorSentinel — Independent Open Track Prototype. Not an official Razorpay product.*
