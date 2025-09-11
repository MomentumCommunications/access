import { lazy, Suspense } from "react";
import { Skeleton } from "~/components/ui/skeleton";

// Lazy load admin-specific components
const ManageMembers = lazy(() => 
  import("~/components/manage-members").then(module => ({
    default: module.ManageMembers
  }))
);

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

// Wrapped components with Suspense
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function LazyManageMembers(props: any) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ManageMembers {...props} />
    </Suspense>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function LazyAddBulletin(props: any) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AddBulletin {...props} />
    </Suspense>
  );
}