export type Role = "admin" | "client";

export interface PanelUser {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
  domains: string[];
  /** Base32 TOTP secret; when set, login requires authenticator code. */
  totpSecret?: string;
}

export interface SessionPayload {
  userId: string;
  username: string;
  role: Role;
  domains: string[];
}

export interface HostedDomain {
  name: string;
  disabled?: boolean | string;
  "values.disabled"?: string;
  plan?: string;
  "values.plan"?: string;
  user?: string;
  "values.user"?: string;
  disk_used?: string;
  "values.disk_used"?: string;
  disk_limit?: string;
  "values.disk_limit"?: string;
  [key: string]: unknown;
}

export interface HostedMailbox {
  name?: string;
  user?: string;
  "values.user"?: string;
  real?: string;
  "values.real"?: string;
  quota?: string;
  "values.quota"?: string;
  [key: string]: unknown;
}

export interface HostedDatabase {
  name?: string;
  "values.name"?: string;
  type?: string;
  "values.type"?: string;
  host?: string;
  "values.host"?: string;
  [key: string]: unknown;
}
