import Link from "next/link";
import type { MemberComparisonRow } from "@/types/database";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { formatDurationShort, formatNumber } from "@/lib/utils/format";

export function ComparisonTable({ rows }: { rows: MemberComparisonRow[] }) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>멤버</Th>
            <Th className="text-right">방송시간</Th>
            <Th className="text-right">방송횟수</Th>
            <Th className="text-right">평균시청자</Th>
            <Th className="text-right">최고시청자</Th>
            <Th className="text-right">조회수</Th>
            <Th className="text-right">캐치</Th>
            <Th className="text-right">클릭</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Tr key={row.member_id}>
              <Td>
                <Link
                  href={`/members/${row.slug ?? row.member_id}`}
                  className="flex items-center gap-2 font-medium text-fg transition-colors hover:text-accent"
                >
                  <MemberAvatar
                    name={row.name}
                    imageUrl={row.profile_image_url}
                    size="sm"
                  />
                  {row.name}
                </Link>
              </Td>
              <Td className="tnum text-right">{formatDurationShort(row.total_duration_seconds)}</Td>
              <Td className="tnum text-right">{formatNumber(row.broadcast_count)}</Td>
              <Td className="tnum text-right">{formatNumber(row.avg_viewers)}</Td>
              <Td className="tnum text-right text-accent">{formatNumber(row.peak_viewers)}</Td>
              <Td className="tnum text-right">{formatNumber(row.total_views)}</Td>
              <Td className="tnum text-right">{formatNumber(row.catch_count)}</Td>
              <Td className="tnum text-right">{formatNumber(row.click_count)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}
