import { premiumLibUnavailable } from "@/lib/premium/unavailable";

export type LinuxUpdateStatus = {
  updatedAt: string;
  upgradable: number;
  security: number;
  rebootRequired: boolean;
  summaryLine: string;
};

export type QadbakUpdateStatus = {
  isGit: boolean;
  commit?: string;
  branch?: string;
  remoteUrl?: string;
  behind?: number;
  upToDate?: boolean;
  checkedAt?: string;
  message?: string;
  error?: string;
};

export type UpdateJobMeta = {
  id: string;
  type: string;
  status: "running" | "done" | "failed";
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
};

export async function probeUpdatesHelperSudo(): Promise<boolean> {
  premiumLibUnavailable("admin-updates");
}

export async function getLinuxUpdateStatus(_refresh = false) {
  premiumLibUnavailable("admin-updates");
}

export async function startLinuxUpgrade() {
  premiumLibUnavailable("admin-updates");
}

export async function getQadbakUpdateStatus() {
  premiumLibUnavailable("admin-updates");
}

export async function startQadbakUpgrade() {
  premiumLibUnavailable("admin-updates");
}

export async function getUpdateJob(_jobId: string) {
  premiumLibUnavailable("admin-updates");
}
