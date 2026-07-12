import type { Metadata } from "next";
import { MarketingLegalPage } from "@/components/MarketingLegalPage";

export const metadata: Metadata = {
  title: "Refund Policy - Qadbak",
  description:
    "14-day refund policy for Qadbak Premium licenses - including the EU right of withdrawal and the digital-content exception.",
};

export default function RefundPage() {
  return <MarketingLegalPage slug="refund" />;
}
