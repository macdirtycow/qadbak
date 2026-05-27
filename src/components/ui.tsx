import Link from "next/link";
import type { ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50";
  const variants = {
    primary: "bg-panel-accent text-white hover:brightness-110",
    secondary: "bg-panel-card border border-panel-border hover:bg-slate-800",
    danger: "bg-red-600/90 text-white hover:bg-red-600",
    ghost: "text-panel-muted hover:text-white hover:bg-panel-card",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-panel-border bg-panel-card p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "bg-slate-700 text-slate-200",
    success: "bg-emerald-900/60 text-emerald-300",
    warning: "bg-amber-900/60 text-amber-300",
    danger: "bg-red-900/60 text-red-300",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const inputClassName =
  "qadbak-field focus:border-panel-link focus:outline-none focus:ring-1 focus:ring-panel-link";

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClassName} ${className}`.trim()} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`qadbak-field ${className}`.trim()} {...props} />;
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm text-panel-muted">
      {children}
    </label>
  );
}

export function Alert({
  children,
  variant = "error",
}: {
  children: ReactNode;
  variant?: "error" | "success" | "info";
}) {
  const styles = {
    error: "border-red-800/50 bg-red-950/40 text-red-200",
    success: "border-emerald-800/50 bg-emerald-950/40 text-emerald-200",
    info: "border-blue-800/50 bg-blue-950/40 text-blue-200",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles[variant]}`}>
      {children}
    </div>
  );
}

export function NavLink({
  href,
  children,
  active,
}: {
  href: string;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm ${
        active
          ? "bg-panel-accent/20 text-white"
          : "text-panel-muted hover:bg-panel-card hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmValue,
  typedValue,
  onTypedChange,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmValue: string;
  typedValue: string;
  onTypedChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  const canConfirm = typedValue === confirmValue;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="max-w-md w-full">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-panel-muted">{description}</p>
        <p className="mt-4 text-sm">
          Type <strong className="text-white">{confirmValue}</strong> to confirm:
        </p>
        <Input
          className="mt-2"
          value={typedValue}
          onChange={(e) => onTypedChange(e.target.value)}
          autoFocus
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={!canConfirm || loading}
          >
            {loading ? "Working…" : confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
