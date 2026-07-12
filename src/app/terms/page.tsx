import type { Metadata } from "next";
import { MarketingLegalPage } from "@/components/MarketingLegalPage";

export const metadata: Metadata = {
  title: "Terms of Service - Qadbak",
  description:
    "The legal terms that apply when you buy a Qadbak Premium license or use the Qadbak panel.",
};

export default function TermsPage() {
  return <MarketingLegalPage slug="terms" />;
}
