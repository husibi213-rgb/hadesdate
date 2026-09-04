import { Skeleton, SkeletonCard, SkeletonRows } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-3 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <SkeletonRows rows={5} />
    </div>
  );
}
