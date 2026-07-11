import { runProvisioningHelper } from "@/lib/provisioner/native-exec";
import type { AppTemplate } from "../types";

export const jellyfinTemplate: AppTemplate = {
  id: "jellyfin",
  label: "Jellyfin",
  tagline: "Your own films & series — private streaming on your VPS.",
  icon: "🎬",
  description:
    "Installs Jellyfin in Docker on media.yourdomain, creates a media upload folder, " +
    "configures HTTPS reverse proxy, and adds a DNS A-record for the media subdomain.",
  etaSeconds: 180,
  inputs: [
    {
      name: "domain",
      label: "Primary domain",
      type: "domain",
      required: true,
      help: "Existing domain (e.g. example.com). Jellyfin will be served at media.example.com.",
    },
    {
      name: "subdomain",
      label: "Media subdomain",
      type: "text",
      defaultValue: "media",
      pattern: "^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$",
      help: "Subdomain prefix — default media → media.example.com",
    },
  ],
  async install({ input }) {
    const domain = input.domain?.trim().toLowerCase();
    const subdomain = (input.subdomain || "media").trim().toLowerCase();
    if (!domain) throw new Error("Domain is required.");
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
      throw new Error("Invalid subdomain prefix.");
    }

    const result = (await runProvisioningHelper(
      "jellyfin-install",
      domain,
      JSON.stringify({ subdomain }),
    )) as {
      adminUrl?: string;
      mediaPath?: string;
      subdomain?: string;
      postInstall?: string[];
    };

    const mediaHost = result.subdomain ?? `${subdomain}.${domain}`;

    return {
      domain,
      primaryUrl: result.adminUrl ?? `https://${mediaHost}/`,
      credentials: result.mediaPath
        ? [{ label: "Media folder (upload films here)", value: result.mediaPath, isSecret: false }]
        : [],
      postInstall:
        result.postInstall?.join(" ") ??
        `Upload your video files to the media folder, then open ${mediaHost} to finish Jellyfin setup and add a library.`,
    };
  },
};
