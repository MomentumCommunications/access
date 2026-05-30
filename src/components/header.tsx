import { Separator } from "./ui/separator";
import { SidebarTrigger } from "./ui/sidebar";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center space-x-2">
          <SidebarTrigger />
        </div>
      </div>
      <Separator />
    </header>
  );
}
