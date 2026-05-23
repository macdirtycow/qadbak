import { APP_NAME, APP_URL, ORG_NAME, ORG_URL } from "@/lib/brand";
import Link from "next/link";

export const metadata = {
  title: `About ${APP_NAME}`,
  description: `Why ${APP_NAME} — from a 2009 headline to an independent hosting panel.`,
};

export default function AboutPage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "3rem 1.5rem",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.6,
        color: "#e2e8f0",
        background: "#06090f",
        minHeight: "100vh",
      }}
    >
      <p style={{ margin: 0 }}>
        <Link href="/" style={{ color: "#5eead4" }}>
          ← {APP_NAME}
        </Link>
      </p>
      <h1 style={{ letterSpacing: "-0.02em" }}>About the name {APP_NAME}</h1>
      <p style={{ color: "#94a3b8" }}>
        {APP_NAME} at {APP_URL} is a control panel by{" "}
        <a href={ORG_URL} style={{ color: "#5eead4" }}>
          {ORG_NAME}
        </a>
        . It is <strong>not</strong> related to the 2009 &ldquo;Qadbak
        Investments&rdquo; entity.
      </p>
      <h2 style={{ fontSize: "1.125rem" }}>2009: headlines, thin air</h2>
      <p style={{ color: "#94a3b8" }}>
        <a
          href="https://en.wikipedia.org/wiki/Qadbak_Investments"
          rel="noopener noreferrer"
          style={{ color: "#5eead4" }}
        >
          Qadbak Investments
        </a>{" "}
        briefly surfaced in football and motorsport press (Notts County, BMW
        Sauber F1). The story aged into a cautionary tale about buzz without
        backing.
      </p>
      <h2 style={{ fontSize: "1.125rem" }}>Today: code on a VPS</h2>
      <p style={{ color: "#94a3b8" }}>
        This project reuses an abandoned brand for something concrete: the{" "}
        <strong>front door</strong> to your VPS — domains, mail, DNS, SSL —
        without a separate legacy control panel. Open the panel at{" "}
        <Link href="/login" style={{ color: "#5eead4" }}>
          /login
        </Link>
        .
      </p>
      <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
        Longer version:{" "}
        <a
          href="https://github.com/macdirtycow/qadbak/blob/main/docs/ABOUT-THE-NAME.md"
          rel="noopener noreferrer"
          style={{ color: "#5eead4" }}
        >
          docs/ABOUT-THE-NAME.md
        </a>
      </p>
    </main>
  );
}
