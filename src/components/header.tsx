import { AppBreadcrumbs } from "./app-breadcrumbs";
import { ApplicationSearch } from "./application-search";
import { NotificationsBell } from "./notifications-bell";
import { Separator } from "./ui/separator";
import { SidebarTrigger } from "./ui/sidebar";

export function Header() {
  return (
    <header className="bg-background sticky top-0 z-50 min-w-0 w-full max-w-full overflow-x-clip">
      <div className="flex min-w-0 max-w-full items-center justify-between p-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <SidebarTrigger />
          <Separator className="h-6" orientation="vertical" />
          <AppBreadcrumbs />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <NotificationsBell />
          <ApplicationSearch />
        </div>
      </div>
      <Separator />
    </header>
  );
}
