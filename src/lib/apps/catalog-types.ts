export type AppCategory =
  | "cms"
  | "tools"
  | "collaboration"
  | "analytics"
  | "ecommerce";

export interface AppCatalogEntry {
  id: string;
  name: string;
  label: string;
  desc: string;
  version: string;
  minPhp?: string;
  requiresDb?: boolean;
  category: AppCategory;
  icon: string;
  tagline: string;
  featured?: boolean;
  comingSoon?: boolean;
  intentMode?: "full" | "domain-only";
  installer?: string;
  etaSeconds?: number;
}
