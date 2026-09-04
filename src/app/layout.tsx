import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "RazorSentinel — AI-Powered Merchant Early-Warning & What-If Intelligence",
  description: "Independent Open Track Prototype — AI-Powered Merchant Early-Warning System",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg-light text-text-primary antialiased">{children}</body>
    </html>
  );
}
