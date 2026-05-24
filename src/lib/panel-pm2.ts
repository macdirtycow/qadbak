import { premiumLibUnavailable } from "@/lib/premium/unavailable";

export type Pm2Process = {
  name: string;
  status: string;
  memory?: number;
  cpu?: number;
};

export async function probePanelPm2Sudo(): Promise<boolean> {
  premiumLibUnavailable("dashboard-panel-control");
}

export async function listPanelPm2Processes(): Promise<Pm2Process[]> {
  premiumLibUnavailable("dashboard-panel-control");
}

export async function runPanelPm2Action(
  _action: "restart" | "stop" | "start" | "restart-terminal" | "restart-all",
): Promise<string> {
  premiumLibUnavailable("dashboard-panel-control");
}
