import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium tracking-wide text-fg-muted uppercase">
        {label}
      </span>
      {children}
      {hint ? <span className="text-[11px] text-fg-dim">{hint}</span> : null}
    </label>
  );
}

const CONTROL =
  "w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg " +
  "outline-none transition-colors placeholder:text-fg-dim focus:border-accent/60";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(CONTROL, "tnum", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-20 resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(CONTROL, className)} {...props} />;
}

export function Checkbox({
  label,
  ...props
}: React.ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-fg-muted">
      <input
        type="checkbox"
        className="size-3.5 accent-[var(--accent)]"
        {...props}
      />
      {label}
    </label>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "border-accent/50 bg-accent/15 text-fg hover:border-accent",
    ghost: "border-border bg-surface/60 text-fg-muted hover:border-border-strong hover:text-fg",
    danger: "border-down/40 bg-down/10 text-down hover:border-down/70",
  }[variant];

  return (
    <button
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
        styles,
        className
      )}
      {...props}
    />
  );
}

/** 폼 결과 알림 (?ok= / ?error= 쿼리로 전달된 메시지) */
export function FormNotice({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-xs",
        error ? "border-down/40 bg-down/5 text-down" : "border-up/40 bg-up/5 text-up"
      )}
    >
      {error ?? ok}
    </div>
  );
}

/**
 * 행 단위 인라인 편집.
 * details/summary 를 쓰므로 클라이언트 상태가 필요 없다.
 */
export function RowEditor({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-border bg-surface/70 transition-colors open:border-border-strong"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3 text-[13px] marker:content-none">
        {summary}
      </summary>
      <div className="border-t border-border px-3.5 py-3.5">{children}</div>
    </details>
  );
}

export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function FormActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-3.5 flex flex-wrap items-center gap-2">{children}</div>;
}
