import { Skeleton, SkeletonCard, SkeletonRows } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-3 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <SkeletonRows rows={6} />
    </div>
  );
}
