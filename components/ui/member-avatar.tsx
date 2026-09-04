import { cn } from "@/lib/utils/cn";

const SIZES = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
} as const;

export function MemberAvatar({
  name,
  imageUrl,
  color,
  size = "md",
  className,
}: {
  name: string;
  imageUrl?: string | null;
  color?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initial = name.trim().slice(0, 2);

  if (imageUrl) {
    return (
      // 외부 이미지 도메인이 유동적이므로 next/image 대신 img 를 사용한다.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className={cn(
          "shrink-0 rounded-full border border-border object-cover",
          SIZES[size],
          className
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-border font-semibold text-fg",
        SIZES[size],
        className
      )}
      style={{ backgroundColor: color ? `${color}22` : undefined }}
      aria-hidden
    >
      {initial}
    </span>
  );
}
