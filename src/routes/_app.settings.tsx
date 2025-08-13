import { createFileRoute } from "@tanstack/react-router";
import { Label } from "~/components/ui/label";
import { useTheme } from "~/components/theme-provider";
import { Button } from "~/components/ui/button";
import { Check, Computer, Moon, Sun } from "lucide-react";
import { cn } from "~/lib/utils";

export const Route = createFileRoute("/_app/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  const { setTheme, theme } = useTheme();

  const isSystem = theme === "system";

  return (
    <div className="h-screen flex w-full items-center justify-start pt-24 flex-col gap-4">
      <div className="p-4 flex flex-col gap-12 align-start w-1/2">
        <h1 className="text-5xl font-bold">Settings</h1>
        <div className="flex gap-4 flex-col justify-start items-start">
          <h2 className="text-2xl font-semibold">Theme</h2>
          <div className="flex gap-4 items-center flex-row">
            <Button
              size="sm"
              variant="outline"
              className="w-6 h-6"
              onClick={() => setTheme("light")}
            >
              <Check className="text-foreground dark:text-background" />
            </Button>
            <Sun />
            <Label>Light</Label>
          </div>
          <div className="flex gap-4 items-center flex-row">
            <Button
              size="sm"
              variant="outline"
              className="w-6 h-6"
              onClick={() => setTheme("dark")}
            >
              <Check
                className={cn(
                  "text-background dark:text-foreground",
                  isSystem && "text-background",
                )}
              />
            </Button>
            <Moon />
            <Label>Dark</Label>
          </div>
          <div className="flex gap-4 items-center flex-row">
            <Button
              size="icon"
              variant="outline"
              className="w-6 h-6"
              onClick={() => setTheme("system")}
            >
              <Check
                className={cn("text-background", isSystem && "text-foreground")}
              />
            </Button>
            <Computer />
            <Label>System</Label>
          </div>
        </div>
      </div>
    </div>
  );
}
