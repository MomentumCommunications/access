import { lazy, Suspense } from "react";
import { Skeleton } from "~/components/ui/skeleton";

// Lazy load the ChatWindow component
const ChatWindow = lazy(() => 
  import("~/components/chat-window").then(module => ({
    default: module.ChatWindow
  }))
);

// Loading fallback for ChatWindow
const ChatWindowSkeleton = () => (
  <div className="flex flex-1 flex-col">
    <div className="flex-1 p-4 space-y-4">
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-12 w-1/3" />
    </div>
    <div className="p-4">
      <Skeleton className="h-12 w-full" />
    </div>
  </div>
);

// Wrapped component with Suspense
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LazyChatWindow(props: any) {
  return (
    <Suspense fallback={<ChatWindowSkeleton />}>
      <ChatWindow {...props} />
    </Suspense>
  );
}