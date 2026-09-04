import { Plus } from "lucide-react";

import { adminGate } from "@/lib/admin/session";
import { getAdminMembers } from "@/lib/admin/queries";
import { deleteMember, saveMember } from "@/lib/admin/actions";
import { LoginScreen } from "@/components/admin/login-screen";
import { loadAdmin } from "@/lib/admin/load";
import {
  Button,
  Checkbox,
  Field,
  FormActions,
  FormGrid,
  FormNotice,
  Input,
  RowEditor,
} from "@/components/admin/form";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { MemberRow } from "@/types/database";

export const metadata = { title: "멤버" };

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const gate = await adminGate();
  const sp = await searchParams;
  if (!gate.ok) return <LoginScreen reason={gate.reason} error={sp.error} />;

  const loaded = await loadAdmin<MemberRow[]>([], getAdminMembers);
  const members = loaded.data;

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-lg font-semibold tracking-tight">멤버</h1>
        <p className="text-xs text-fg-muted">
          이름과 프로필 이미지는 수집기가 SOOP 에서 자동으로 갱신합니다. 채널 ID 만 정확히 넣으면 됩니다.
        </p>
      </div>

      <FormNotice ok={sp.ok} error={sp.error} />

      {loaded.error ? <ErrorState description={loaded.error} /> : null}

      <RowEditor
        summary={
          <span className="inline-flex items-center gap-1.5 font-medium text-accent">
            <Plus className="size-3.5" />
            멤버 추가
          </span>
        }
      >
        <MemberForm />
      </RowEditor>

      {members.length === 0 ? (
        <EmptyState title="등록된 멤버가 없습니다" />
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <RowEditor
              key={member.id}
              summary={
                <>
                  <MemberAvatar
                    name={member.name}
                    imageUrl={member.profile_image_url}
                    color={member.color}
                    size="sm"
                  />
                  <span className="font-medium text-fg">{member.name}</span>
                  <span className="text-[11px] text-fg-dim">{member.channel_id ?? "-"}</span>
                  {member.is_active ? null : <Badge variant="warn">비활성</Badge>}
                  <span className="ml-auto text-[11px] text-fg-dim">편집</span>
                </>
              }
            >
              <MemberForm member={member} />
            </RowEditor>
          ))}
        </div>
      )}
    </>
  );
}

function MemberForm({ member }: { member?: MemberRow }) {
  return (
    <div className="space-y-3">
      <form action={saveMember}>
        {member ? <input type="hidden" name="id" value={member.id} /> : null}

        <FormGrid>
          <Field label="이름" hint="수집기가 SOOP 닉네임으로 덮어씁니다">
            <Input name="name" defaultValue={member?.name ?? ""} required />
          </Field>
          <Field label="채널 ID" hint="sooplive.com/station/<여기>">
            <Input name="channel_id" defaultValue={member?.channel_id ?? ""} />
          </Field>
          <Field label="slug" hint="URL 에 쓰는 짧은 이름 (비우면 uuid 사용)">
            <Input name="slug" defaultValue={member?.slug ?? ""} />
          </Field>
          <Field label="채널 URL" className="sm:col-span-2">
            <Input name="channel_url" type="url" defaultValue={member?.channel_url ?? ""} />
          </Field>
          <Field label="프로필 이미지 URL">
            <Input
              name="profile_image_url"
              type="url"
              defaultValue={member?.profile_image_url ?? ""}
            />
          </Field>
          <Field label="색상" hint="그래프·아바타에 쓰이는 hex (예: #6d8cff)">
            <Input name="color" defaultValue={member?.color ?? ""} placeholder="#6d8cff" />
          </Field>
        </FormGrid>

        <FormActions>
          <Checkbox name="is_active" label="활성" defaultChecked={member?.is_active ?? true} />
          <Button type="submit" className="ml-auto">
            {member ? "저장" : "추가"}
          </Button>
        </FormActions>
      </form>

      {member ? (
        <form action={deleteMember} className="border-t border-border pt-3">
          <input type="hidden" name="id" value={member.id} />
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-fg-dim">
              삭제하면 이 멤버의 방송·캐치·스냅샷이 모두 함께 삭제됩니다. 보통은 비활성으로 두는 편이 낫습니다.
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
