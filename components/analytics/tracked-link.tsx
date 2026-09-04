"use client";

import * as React from "react";
import Link from "next/link";

import { getSessionId } from "@/lib/client/session-id";
import type { ClickTargetType } from "@/types/database";

export interface TrackedLinkProps {
  href: string;
  targetType: ClickTargetType;
  targetId?: string | null;
  memberId?: string | null;
  broadcastId?: string | null;
  /** 외부 링크면 새 탭으로 연다 */
  external?: boolean;
  className?: string;
  title?: string;
  children: React.ReactNode;
}

/**
 * 클릭을 익명으로 집계하는 링크.
 *
 * sendBeacon 을 쓰므로 페이지 이동을 막지 않고, 실패해도 이동에는 영향이 없다.
 * 저장되는 것은 대상 종류 / 대상 id / 익명 세션 해시뿐이다.
 */
export function TrackedLink({
  href,
  targetType,
  targetId,
  memberId,
  broadcastId,
  external = false,
  className,
  title,
  children,
}: TrackedLinkProps) {
  const track = React.useCallback(() => {
    try {
      const payload = JSON.stringify({
        targetType,
        targetId: targetId ?? null,
        memberId: memberId ?? null,
        broadcastId: broadcastId ?? null,
        sessionId: getSessionId(),
      });

      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        navigator.sendBeacon("/api/clicks", new Blob([payload], { type: "application/json" }));
        return;
      }

      void fetch("/api/clicks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // 집계 실패가 이동을 막지 않게 한다.
    }
  }, [targetType, targetId, memberId, broadcastId]);

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={title}
        onClick={track}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} title={title} onClick={track}>
      {children}
    </Link>
  );
}
