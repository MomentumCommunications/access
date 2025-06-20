import { UserButton } from "@clerk/tanstack-react-start";
import { ModeToggle } from "./mode-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Separator } from "./ui/separator";
import { SidebarTrigger } from "./ui/sidebar";

export function Header({
  currentPage,
  breadcrumbs,
}: {
  currentPage: string;
  breadcrumbs: {
    title: string;
    url: string;
  }[];
}) {
  return (
    <header className="mb-4 sticky top-0 z-50 bg-background">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center space-x-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs?.map((breadcrumb) => (
                <div
                  key={breadcrumb.title}
                  className="flex items-center gap-0 md:gap-2"
                >
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href={breadcrumb.url}>
                      {breadcrumb.title}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </div>
              ))}
              <BreadcrumbItem>
                <BreadcrumbPage>{currentPage}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="px-2 flex items-center space-x-2">
          <ModeToggle />
          <UserButton />
        </div>
      </div>
      <Separator />
    </header>
  );
}
