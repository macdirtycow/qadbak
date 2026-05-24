export class PremiumRequiredError extends Error {
  readonly feature: string;
  readonly status = 503;

  constructor(feature: string, message?: string) {
    super(message ?? `Premium license required for: ${feature}`);
    this.name = "PremiumRequiredError";
    this.feature = feature;
  }
}

export interface LoadedPremiumModule {
  default?: unknown;
  [key: string]: unknown;
}

export type PremiumHandler = (
  request: Request,
  context?: { params?: Record<string, string> },
) => Promise<Response>;

import type { JSX } from "react";

export type PremiumComponent = (
  props: Record<string, unknown>,
) => JSX.Element | null;
