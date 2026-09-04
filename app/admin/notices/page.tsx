import { ExternalLink, Plus } from "lucide-react";

import { adminGate } from "@/lib/admin/session";
import { getAdminNotices, getMemberOptions, type AdminNotice, type MemberOption } from "@/lib/admin/queries";
import { deleteNotice, saveNotice } from "@/lib/admin/actions";
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
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { NOTICE_SOURCE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils/dates";
import { toDateTimeInput } from "@/lib/utils/datetime-input";
import type { NoticeSource } from "@/types/database";

export const metadata = { title: "공지" };

const SOURCES: NoticeSource[] = ["broadcast_station", "cafe", "other"];

export default async function AdminNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; page?: string }>;
}) {
  const gate = await adminGate();
  const sp = await searchParams;
  if (!gate.ok) return <LoginScreen reason={gate.reason} error={sp.error} />;

  const page = Math.max(1, Number(sp.page) || 1);
  const [membersLoaded, noticesLoaded] = await Promise.all([
    loadAdmin<MemberOption[]>([], getMemberOptions),
    loadAdmin({ rows: [], hasNext: false }, () => getAdminNotices({ page })),
  ]);
  const members = membersLoaded.data;
  const result = noticesLoaded.data;
  const loadError = membersLoaded.error ?? noticesLoaded.error;

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-lg font-semibold tracking-tight">공지</h1>
        <p className="text-xs text-fg-muted">
          공지는 자동 수집하지 않습니다. 원문 전체를 옮기지 말고 제목·요약·원문 링크만 넣어 주세요.
        </p>
      </div>

      <FormNotice ok={sp.ok} error={sp.error} />

      {loadError ? <ErrorState description={loadError} /> : null}

      <RowEditor
        summary={
          <span className="inline-flex items-center gap-1.5 font-medium text-accent">
            <Plus className="size-3.5" />
            공지 추가
          </span>
        }
      >
        <NoticeForm members={members} />
      </RowEditor>

      {result.rows.length === 0 ? (
        <EmptyState
          title="공지가 없습니다"
          description="위에서 추가하면 대시보드와 날짜 페이지에 바로 나타납니다."
        />
      ) : (
        <div className="space-y-2">
          {result.rows.map((notice) => (
            <RowEditor
              key={notice.id}
              summary={
                <>
                  <span className="tnum shrink-0 text-[11px] text-fg-dim">
                    {formatDate(notice.published_at ?? notice.created_at)}
                  </span>
                  <Badge variant={notice.source === "cafe" ? "accent" : "warn"}>
                    {NOTICE_SOURCE_LABELS[notice.source]}
                  </Badge>
                  <span className="truncate font-medium text-fg">{notice.title}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-fg-dim">
                    {notice.memberIds.length
                      ? `멤버 ${notice.memberIds.length}명 연결`
                      : "연결 없음"}
                  </span>
                </>
              }
            >
              <NoticeForm members={members} notice={notice} />
            </RowEditor>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        hasNext={result.hasNext}
        buildHref={(p) => (p > 1 ? `/admin/notices?page=${p}` : "/admin/notices")}
      />
    </>
  );
}

function NoticeForm({
  members,
  notice,
}: {
  members: MemberOption[];
  notice?: AdminNotice;
}) {
  return (
    <div className="space-y-3">
      <form action={saveNotice}>
        {notice ? <input type="hidden" name="id" value={notice.id} /> : null}

        <FormGrid>
          <Field label="출처">
            <Select name="source" defaultValue={notice?.source ?? "broadcast_station"}>
              {SOURCES.map((source) => (
                <option key={source} value={source}>
                  {NOTICE_SOURCE_LABELS[source]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="게시 시각 (KST)">
            <Input
              type="datetime-local"
              name="published_at"
              defaultValue={toDateTimeInput(notice?.published_at ?? notice?.created_at)}
            />
          </Field>
          <Field label="원문 링크">
            <Input name="url" type="url" defaultValue={notice?.url ?? ""} />
          </Field>

          <Field label="제목" className="sm:col-span-2 xl:col-span-3">
            <Input name="title" defaultValue={notice?.title ?? ""} required />
          </Field>
          <Field
            label="요약"
            hint="원문 전체를 붙이지 말고 한두 문장으로"
            className="sm:col-span-2 xl:col-span-3"
          >
            <Textarea name="summary" defaultValue={notice?.summary ?? ""} />
          </Field>
        </FormGrid>

        <fieldset className="mt-3">
          <legend className="text-[11px] font-medium tracking-wide text-fg-muted uppercase">
            관련 멤버
          </legend>
          <p className="mt-0.5 text-[11px] text-fg-dim">
            연결하면 그 멤버의 방송 상세 페이지에도 이 공지가 나타납니다.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {members.map((member) => (
              <label
                key={member.id}
                className="flex items-center gap-1.5 text-[13px] text-fg-muted"
              >
                <input
                  type="checkbox"
                  name="member_ids"
                  value={member.id}
                  defaultChecked={notice?.memberIds.includes(member.id) ?? false}
                  className="size-3.5 accent-[var(--accent)]"
                />
                {member.name}
              </label>
            ))}
          </div>
        </fieldset>

        <FormActions>
          {notice?.url ? (
            <a
              href={notice.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-fg-muted transition-colors hover:text-fg"
            >
              원문 열기
              <ExternalLink className="size-3" />
            </a>
          ) : null}
          <Button type="submit" className="ml-auto">
            {notice ? "저장" : "추가"}
          </Button>
        </FormActions>
      </form>

      {notice ? (
        <form action={deleteNotice} className="border-t border-border pt-3">
          <input type="hidden" name="id" value={notice.id} />
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
