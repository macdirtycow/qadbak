import { runGlobalTool } from "./panel-tools";

export type PanelPolicy = {
  requireClientTotp: boolean;
};

export async function getPanelPolicy(): Promise<PanelPolicy> {
  try {
    const raw = await runGlobalTool("panel-policy-get");
    const policy = (raw as { policy?: PanelPolicy }).policy ?? raw;
    return {
      requireClientTotp: Boolean(
        (policy as PanelPolicy).requireClientTotp ??
          (raw as { requireClientTotp?: boolean }).requireClientTotp,
      ),
    };
  } catch {
    return { requireClientTotp: false };
  }
}
