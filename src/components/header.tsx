import { UserButton } from "@clerk/tanstack-react-start";
import { ModeToggle } from "./mode-toggle";
import { InboxButton } from "./inbox-button";
import { Separator } from "./ui/separator";
import { SidebarTrigger } from "./ui/sidebar";
import { SearchBar } from "./search-bar";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center space-x-2">
          <SidebarTrigger />
        </div>
        <SearchBar />
        <div className="px-2 flex items-center space-x-2">
          <InboxButton />
          <ModeToggle />
          <UserButton />
        </div>
      </div>
      <Separator />
    </header>
  );
}
