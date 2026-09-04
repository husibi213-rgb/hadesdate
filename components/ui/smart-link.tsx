import * as React from "react";
import Link from "next/link";

/**
 * 내부/외부 링크를 한 컴포넌트로 다룬다.
 *
 * 외부 링크(SOOP 원본 등)는 새 탭으로 열고 rel 을 붙여야 하는데,
 * 카드마다 조건 분기를 두면 지저분해져서 여기 한 곳으로 모았다.
 * 클릭 수집 기능을 걷어내면서 쓰던 TrackedLink 자리를 대신한다.
 */
export function SmartLink({
  href,
  external = false,
  children,
  className,
  ...rest
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
  className?: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        {...rest}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}
