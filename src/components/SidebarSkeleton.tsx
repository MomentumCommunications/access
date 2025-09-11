import { Skeleton } from "~/components/ui/skeleton";

export function SidebarSkeleton() {
  return (
    <div className="w-64 bg-sidebar border-r p-4 space-y-4">
      {/* Header */}
      <div className="text-center py-4">
        <Skeleton className="h-6 w-32 mx-auto" />
      </div>
      
      {/* Navigation */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
      </div>
      
      {/* Chat Section */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
      
      {/* DM Section */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
      
      {/* Settings Section */}
      <div className="space-y-2 mt-auto">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}