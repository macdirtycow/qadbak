import { APP_NAME, APP_NAME_BLURB, ORG_NAME, ORG_URL } from "@/lib/brand";
import Link from "next/link";

interface PanelFooterProps {
  /** Show one-line origin story (login page). */
  showBlurb?: boolean;
}

export function PanelFooter({ showBlurb = false }: PanelFooterProps) {
  return (
    <footer className="border-t border-panel-border pt-6 text-center text-xs text-panel-muted">
      {showBlurb && (
        <p className="mx-auto mb-3 max-w-md italic text-panel-muted/90">
          {APP_NAME_BLURB}
        </p>
      )}
      <p>
        {APP_NAME} ·{" "}
        <a href={ORG_URL} className="hover:text-white" rel="noopener noreferrer">
          {ORG_NAME}
        </a>
        {" · "}
        <Link href="/about" className="hover:text-white underline-offset-2 hover:underline">
          About the name
        </Link>
      </p>
    </footer>
  );
}
