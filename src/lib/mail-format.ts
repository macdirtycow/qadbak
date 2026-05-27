import { parseEmailAddress } from "@/lib/mail-reply";

/** Display name from From header (before <email>). */
export function formatFromDisplay(from: string | undefined): string {
  const raw = String(from || "").trim();
  if (!raw) return "Unknown";
  const angle = raw.match(/^(.+?)\s*<[^>]+>$/);
  if (angle) return angle[1].replace(/^["']|["']$/g, "").trim() || parseEmailAddress(raw);
  if (raw.includes("@")) return parseEmailAddress(raw);
  return raw;
}

export function senderInitials(from: string | undefined): string {
  const name = formatFromDisplay(from);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  const email = parseEmailAddress(from);
  if (email) return email.slice(0, 2).toUpperCase();
  return (name[0] ?? "?").toUpperCase();
}

export function formatMailDate(dateStr: string | undefined): string {
  const raw = String(dateStr || "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  if (d.getTime() > weekAgo) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function folderIcon(folder: string): string {
  const f = folder.toUpperCase();
  if (f === "INBOX") return "📥";
  if (f.includes("SENT")) return "📤";
  if (f.includes("DRAFT")) return "📝";
  if (f.includes("TRASH") || f === "DELETED") return "🗑";
  if (f.includes("JUNK") || f.includes("SPAM")) return "⚠";
  if (f.includes("ARCHIVE")) return "📦";
  return "📁";
}
