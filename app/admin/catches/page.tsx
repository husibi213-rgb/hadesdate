import { ExternalLink, Plus } from "lucide-react";

import { adminGate } from "@/lib/admin/session";
import {
  getAdminCatches,
  getMemberOptions,
  getRecentBroadcastOptions,
  type MemberOption,
} from "@/lib/admin/queries";
import { deleteCatch, saveCatch } from "@/lib/admin/actions";
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
  Textarea,
} from "@/components/admin/form";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { formatNumber, formatTimestamp } from "@/lib/utils/format";
import { toDateTimeInput } from "@/lib/utils/datetime-input";
import type { CatchWithMember } from "@/lib/queries/catches";

export const metadata = { title: "캐치" };

export default async function AdminCatchesPage({
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

  const [catchesLoaded, optionsLoaded] = await Promise.all([
    loadAdmin({ rows: [], hasNext: false }, () =>
      getAdminCatches({ page, memberId: selected?.id ?? null })
    ),
    loadAdmin<{ id: string; label: string }[]>([], () =>
      getRecentBroadcastOptions(selected?.id ?? null)
    ),
  ]);
  const result = catchesLoaded.data;
  const broadcastOptions = optionsLoaded.data;
  const loadError = membersLoaded.error ?? catchesLoaded.error ?? optionsLoaded.error;

  const query = (extra: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { member: sp.member, ...extra };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/admin/catches?${qs}` : "/admin/catches";
  };

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-lg font-semibold tracking-tight">캐치</h1>
        <p className="text-xs text-fg-muted">
          원본을 복제하지 않습니다. 제목·썸네일·원본 링크만 저장합니다. 조회수·좋아요는 수집기가 갱신합니다.
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
            캐치 직접 추가
          </span>
        }
      >
        <CatchForm members={members} broadcastOptions={broadcastOptions} />
      </RowEditor>

      {result.rows.length === 0 ? (
        <EmptyState title="캐치가 없습니다" />
      ) : (
        <div className="space-y-2">
          {result.rows.map((item) => (
            <RowEditor
              key={item.id}
              summary={
                <>
                  <span className="tnum shrink-0 text-[11px] text-fg-dim">{item.catch_date}</span>
                  <span className="shrink-0 font-medium text-fg">{item.member?.name ?? "?"}</span>
                  <span className="truncate text-fg-muted">{item.title ?? "제목 없음"}</span>
                  <span className="tnum ml-auto shrink-0 text-[11px] text-fg-dim">
                    조회 {formatNumber(item.views)} · ♥ {formatNumber(item.likes)}
                    {item.broadcast_id ? "" : " · 방송 미연결"}
                  </span>
                </>
              }
            >
              <CatchForm
                members={members}
                broadcastOptions={broadcastOptions}
                item={item}
              />
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

function CatchForm({
  members,
  broadcastOptions,
  item,
}: {
  members: MemberOption[];
  broadcastOptions: { id: string; label: string }[];
  item?: CatchWithMember;
}) {
  return (
    <div className="space-y-3">
      <form action={saveCatch}>
        {item ? <input type="hidden" name="id" value={item.id} /> : null}

        <FormGrid>
          <Field label="멤버">
            <Select name="member_id" defaultValue={item?.member_id ?? ""} required>
              <option value="">선택</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="연결 방송" hint="비우면 미연결 상태로 저장됩니다">
            <Select name="broadcast_id" defaultValue={item?.broadcast_id ?? ""}>
              <option value="">연결 없음</option>
              {broadcastOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
              {/* 현재 연결된 방송이 목록(최근 60건) 밖이면 값이 사라지지 않게 유지한다 */}
              {item?.broadcast_id && !broadcastOptions.some((o) => o.id === item.broadcast_id) ? (
                <option value={item.broadcast_id}>{item.broadcast_id}</option>
              ) : null}
            </Select>
          </Field>
          <Field label="게시 시각 (KST)">
            <Input
              type="datetime-local"
              name="published_at"
              defaultValue={toDateTimeInput(item?.published_at ?? item?.created_at)}
            />
          </Field>

          <Field label="제목" className="sm:col-span-2">
            <Input name="title" defaultValue={item?.title ?? ""} />
          </Field>
          <Field label="방송 내 시각(초)" hint={formatTimestamp(item?.broadcast_timestamp ?? null)}>
            <Input
              type="number"
              name="broadcast_timestamp"
              defaultValue={item?.broadcast_timestamp ?? ""}
            />
          </Field>

          <Field label="원본 링크" className="sm:col-span-2">
            <Input name="catch_url" type="url" defaultValue={item?.catch_url ?? ""} required />
          </Field>
          <Field label="썸네일 URL">
            <Input name="thumbnail_url" type="url" defaultValue={item?.thumbnail_url ?? ""} />
          </Field>

          <Field label="조회수">
            <Input type="number" name="views" defaultValue={item?.views ?? 0} />
          </Field>
          <Field label="좋아요">
            <Input type="number" name="likes" defaultValue={item?.likes ?? 0} />
          </Field>
          <Field label="설명" className="sm:col-span-2 xl:col-span-3">
            <Textarea name="description" defaultValue={item?.description ?? ""} />
          </Field>
        </FormGrid>

        <FormActions>
          {item ? (
            <a
              href={item.catch_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-fg-muted transition-colors hover:text-fg"
            >
              원본 열기
              <ExternalLink className="size-3" />
            </a>
          ) : null}
          <Button type="submit" className="ml-auto">
            {item ? "저장" : "추가"}
          </Button>
        </FormActions>
      </form>

      {item ? (
        <form action={deleteCatch} className="border-t border-border pt-3">
          <input type="hidden" name="id" value={item.id} />
          <div className="flex items-center justify-end">
            <Button variant="danger" type="submit">
              삭제
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
