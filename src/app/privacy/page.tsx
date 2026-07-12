import type { Metadata } from "next";
import { MarketingLegalPage } from "@/components/MarketingLegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Qadbak",
  description:
    "How Qadbak (by Inveil) collects, uses and protects personal data — GDPR-compliant privacy policy.",
};

export default function PrivacyPage() {
  return <MarketingLegalPage slug="privacy" />;
}
