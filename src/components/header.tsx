import { AppBreadcrumbs } from "./app-breadcrumbs";
import { ApplicationSearch } from "./application-search";
import { NotificationsBell } from "./notifications-bell";
import { Separator } from "./ui/separator";
import { SidebarTrigger } from "./ui/sidebar";

export function Header() {
  return (
    <header className="bg-background sticky top-0 z-50">
      <div className="flex min-w-0 items-center justify-between p-2">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger />
          <Separator className="h-6" orientation="vertical" />
          <AppBreadcrumbs />
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <ApplicationSearch />
        </div>
      </div>
      <Separator />
    </header>
  );
}
