import { CatchArchive, type CatchArchiveSearchParams } from "@/components/catches/catch-archive";

export const metadata = { title: "유저클립" };

export default async function ClipsPage({
  searchParams,
}: {
  searchParams: Promise<CatchArchiveSearchParams>;
}) {
  return (
    <CatchArchive
      kind="clip"
      basePath="/clips"
      title="유저클립"
      emptyLabel="유저클립"
      searchParams={await searchParams}
    />
  );
}
