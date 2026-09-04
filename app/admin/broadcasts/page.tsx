import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";

import { adminGate } from "@/lib/admin/session";
import { getAdminBroadcasts, getMemberOptions, type MemberOption } from "@/lib/admin/queries";
import { deleteBroadcast, saveBroadcast } from "@/lib/admin/actions";
import { LoginScreen } from "@/components/admin/login-screen";
import { loadAdmin } from "@/lib/admin/load";
import {
  Button,
  Field,
  FormActions,
  FormGrid,
  FormNotice,
  Input,
  RowEditor,
  Select,
} from "@/components/admin/form";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Pagination } from "@/components/ui/pagination";
import { Badge, LiveBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { formatDate, formatTime } from "@/lib/utils/dates";
import { formatDurationShort, formatNumber } from "@/lib/utils/format";
import { toDateTimeInput } from "@/lib/utils/datetime-input";
import type { BroadcastWithMember } from "@/lib/queries/broadcasts";

export const metadata = { title: "방송" };

export default async function AdminBroadcastsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; page?: string; member?: string }>;
}) {
  const gate = await adminGate();
  const sp = await searchParams;
  if (!gate.ok) return <LoginScreen reason={gate.reason} error={sp.error} />;

  const page = Math.max(1, Number(sp.page) || 1);
  const membersLoaded = await loadAdmin<MemberOption[]>([], getMemberOptions);
  const members = membersLoaded.data;
  const selected = members.find((m) => m.id === sp.member) ?? null;
  const loaded = await loadAdmin({ rows: [], hasNext: false }, () =>
    getAdminBroadcasts({ page, memberId: selected?.id ?? null })
  );
  const result = loaded.data;
  const loadError = membersLoaded.error ?? loaded.error;

  const query = (extra: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { member: sp.member, ...extra };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/admin/broadcasts?${qs}` : "/admin/broadcasts";
  };

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-lg font-semibold tracking-tight">방송</h1>
        <p className="text-xs text-fg-muted">
          평균·최고 시청자는 방송 종료 시 스냅샷에서 자동 계산됩니다. 여기서 고친 값은 다음 종료 처리 때 덮어써질 수 있습니다.
        </p>
      </div>

      <FormNotice ok={sp.ok} error={sp.error} />

      {loadError ? <ErrorState description={loadError} /> : null}

      <FilterTabs
        activeKey={selected?.id ?? "all"}
        items={[
          { key: "all", label: "전체", href: query({ member: undefined, page: undefined }) },
          ...members.map((m) => ({
            key: m.id,
            label: m.name,
            href: query({ member: m.id, page: undefined }),
          })),
        ]}
      />

      <RowEditor
        summary={
          <span className="inline-flex items-center gap-1.5 font-medium text-accent">
            <Plus className="size-3.5" />
            방송 직접 추가
          </span>
        }
      >
        <BroadcastForm members={members} />
      </RowEditor>

      {result.rows.length === 0 ? (
        <EmptyState title="방송 기록이 없습니다" />
      ) : (
        <div className="space-y-2">
          {result.rows.map((broadcast) => (
            <RowEditor
              key={broadcast.id}
              summary={
                <>
                  <span className="tnum shrink-0 text-[11px] text-fg-dim">
                    {formatDate(broadcast.started_at)}
                  </span>
                  <span className="shrink-0 font-medium text-fg">
                    {broadcast.member?.name ?? "?"}
                  </span>
                  {broadcast.status === "live" ? <LiveBadge /> : null}
                  {broadcast.status === "cancelled" ? (
                    <Badge variant="warn">취소</Badge>
                  ) : null}
                  <span className="truncate text-fg-muted">{broadcast.title ?? "제목 없음"}</span>
                  <span className="tnum ml-auto shrink-0 text-[11px] text-fg-dim">
                    {formatDurationShort(broadcast.duration_seconds)} · 평균{" "}
                    {formatNumber(broadcast.avg_viewers)}
                  </span>
                </>
              }
            >
              <BroadcastForm members={members} broadcast={broadcast} />
            </RowEditor>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        hasNext={result.hasNext}
        buildHref={(p) => query({ page: p > 1 ? String(p) : undefined })}
      />
    </>
  );
}

function BroadcastForm({
  members,
  broadcast,
}: {
  members: MemberOption[];
  broadcast?: BroadcastWithMember;
}) {
  return (
    <div className="space-y-3">
      <form action={saveBroadcast}>
        {broadcast ? <input type="hidden" name="id" value={broadcast.id} /> : null}

        <FormGrid>
          <Field label="멤버">
            <Select name="member_id" defaultValue={broadcast?.member_id ?? ""} required>
              <option value="">선택</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="상태">
            <Select name="status" defaultValue={broadcast?.status ?? "ended"}>
              <option value="ended">종료</option>
              <option value="live">방송 중</option>
              <option value="cancelled">취소</option>
            </Select>
          </Field>
          <Field label="제목" className="xl:col-span-1">
            <Input name="title" defaultValue={broadcast?.title ?? ""} />
          </Field>

          <Field label="시작 (KST)">
            <Input
              type="datetime-local"
              name="started_at"
              defaultValue={toDateTimeInput(broadcast?.started_at)}
              required
            />
          </Field>
          <Field label="종료 (KST)" hint="비우면 진행 중으로 둡니다">
            <Input
              type="datetime-local"
              name="ended_at"
              defaultValue={toDateTimeInput(broadcast?.ended_at)}
            />
          </Field>
          <Field label="방송시간" hint="시작·종료로 자동 계산됩니다">
            <Input
              value={formatDurationShort(broadcast?.duration_seconds ?? 0)}
              readOnly
              disabled
            />
          </Field>

          <Field label="평균 시청자">
            <Input type="number" name="avg_viewers" defaultValue={broadcast?.avg_viewers ?? 0} />
          </Field>
          <Field label="최고 시청자">
            <Input type="number" name="peak_viewers" defaultValue={broadcast?.peak_viewers ?? 0} />
          </Field>
          <Field label="조회수">
            <Input type="number" name="views" defaultValue={broadcast?.views ?? 0} />
          </Field>
          <Field label="팔로워 증가">
            <Input
              type="number"
              name="followers_gained"
              defaultValue={broadcast?.followers_gained ?? 0}
            />
          </Field>
          <Field label="VOD URL" className="sm:col-span-2">
            <Input name="vod_url" type="url" defaultValue={broadcast?.vod_url ?? ""} />
          </Field>
          <Field label="썸네일 URL" className="sm:col-span-2">
            <Input name="thumbnail_url" type="url" defaultValue={broadcast?.thumbnail_url ?? ""} />
          </Field>
        </FormGrid>

        <FormActions>
          {broadcast ? (
            <>
              <Link
                href={`/broadcasts/${broadcast.id}`}
                className="inline-flex items-center gap-1 text-xs text-fg-muted transition-colors hover:text-fg"
              >
                사이트에서 보기
                <ExternalLink className="size-3" />
              </Link>
              <span className="tnum text-[11px] text-fg-dim">
                {formatTime(broadcast.started_at)}
                {broadcast.ended_at ? ` ~ ${formatTime(broadcast.ended_at)}` : " ~"}
              </span>
            </>
          ) : null}
          <Button type="submit" className="ml-auto">
            {broadcast ? "저장" : "추가"}
          </Button>
        </FormActions>
      </form>

      {broadcast ? (
        <form action={deleteBroadcast} className="border-t border-border pt-3">
          <input type="hidden" name="id" value={broadcast.id} />
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-fg-dim">
              삭제하면 이 방송의 시청자 스냅샷과 캐치 연결도 함께 정리됩니다.
            </p>
            <Button variant="danger" type="submit" className="ml-auto shrink-0">
              삭제
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
