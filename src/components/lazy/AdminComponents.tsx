import { lazy, Suspense } from "react";
import { Skeleton } from "~/components/ui/skeleton";

const AddBulletin = lazy(() => 
  import("~/components/add-bulletin").then(module => ({
    default: module.AddBulletin
  }))
);

// Loading fallbacks
const AdminSkeleton = () => (
  <div className="space-y-4">
    <Skeleton className="h-8 w-32" />
    <Skeleton className="h-12 w-full" />
  </div>
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function LazyAddBulletin(props: any) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AddBulletin {...props} />
    </Suspense>
  );
}
