import { UserButton } from "@clerk/tanstack-react-start";
import { ModeToggle } from "./mode-toggle";
import { Separator } from "./ui/separator";
import { SidebarTrigger } from "./ui/sidebar";
import { Search } from "./search";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center space-x-2">
          <SidebarTrigger />
        </div>
        <Search />
        <div className="px-2 flex items-center space-x-2">
          <ModeToggle />
          <UserButton />
        </div>
      </div>
      <Separator />
    </header>
  );
}
