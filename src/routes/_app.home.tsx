import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Authenticated, Unauthenticated } from "convex/react";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LazyAddBulletin } from "~/components/lazy/AdminComponents";
import { AdminBulletin } from "~/components/admin-bulletin";
import { ProtectedContent } from "~/components/protected-content";
import { Button } from "~/components/ui/button";
import { Card, CardDescription, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { BulletinFeed } from "~/components/bulletin-feed";
import { useCurrentUser } from "~/hooks/useCurrentUser";
import { hasUserRole } from "~/lib/roles";

export const Route = createFileRoute("/_app/home")({
  component: Home,
});

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true)
  );
}

function PwaInstallBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const isMobileBrowser =
      window.matchMedia("(max-width: 767px)").matches &&
      navigator.maxTouchPoints > 0 &&
      !isStandaloneApp();

    setIsVisible(isMobileBrowser);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  async function handleInstall() {
    if (!installPrompt) {
      window.location.href = "/help#install-app";
      return;
    }

    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary p-2 text-primary-foreground">
          <Download className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h2 className="text-sm font-semibold">Install Access Momentum</h2>
            <p className="text-sm text-muted-foreground">
              Add the portal to your home screen for a faster app-like launch.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleInstall}>
              {installPrompt ? "Install" : "Show me how"}
            </Button>
            {installPrompt && (
              <Button variant="outline" size="sm" asChild>
                <a href="/help#install-app">Show me how</a>
              </Button>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-m-2 size-8 shrink-0"
          onClick={() => setIsVisible(false)}
          aria-label="Dismiss install prompt"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Home() {
  // TODO: change array indexed passkeys to be more dynamic
  const { data: userData, isLoading } = useCurrentUser();

  const isAdmin = hasUserRole(userData, "admin");

  const userGroups = userData?.group || [];

  const { data: groups, isLoading: groupsLoading } = useQuery(
    convexQuery(api.etcFunctions.getGroups, {}),
  );

  const passwords = groups?.map((group) => group.password);

  const [groupPassword, setGroupPassword] = useState<string | null>(null);
  const [inputPassword, setInputPassword] = useState("");
  const [checkingStorage, setCheckingStorage] = useState(true);

  // On mount, read stored password
  useEffect(() => {
    const stored = localStorage.getItem("groupPassword");
    if (stored) setGroupPassword(stored);
    setCheckingStorage(false);
  }, []);

  // Validate password (example)
  const validatePassword = (password: string) => {
    return passwords?.includes(password);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validatePassword(inputPassword)) {
      localStorage.setItem("groupPassword", inputPassword);
      setGroupPassword(inputPassword);
    } else {
      alert("Invalid password");
    }
  };

  // Show loading spinner while checking localStorage or loading groups
  if (checkingStorage || groupsLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-12">
        <div className="animate-pulse text-center">loading...</div>
      </div>
    ); // Replace with your spinner component
  }

  if (isLoading) {
    return null;
  }

  if (!groupPassword) {
    // Show password input form
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-12">
        <div className="fixed top-12 flex flex-col items-center gap-4 lg:top-32">
          <img
            src="/logo_transparent.png"
            alt="Access Momentum Logo"
            height={150}
            width={150}
            className="rounded-full"
          />
          <h1 className="text-center text-2xl font-bold lg:text-4xl">
            ACCESS MOMENTUM
          </h1>
        </div>
        <Card className="h-min p-4">
          <CardTitle>Enter Password</CardTitle>
          <CardDescription>
            Please enter the access password to view this page.
          </CardDescription>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              placeholder="Enter access password"
            />
            <Button type="submit">Submit</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center overscroll-contain">
      <main className="w-full max-w-3xl p-4">
        <PwaInstallBanner />
        <div className="flex flex-col justify-start gap-4 py-4">
          <Unauthenticated>
            <div className="py-4">
              <h1 className="text-center text-4xl font-bold">
                ACCESS MOMENTUM
              </h1>
            </div>
            <ProtectedContent password={groupPassword} />
          </Unauthenticated>
        </div>
        <Authenticated>
          <div className="flex justify-between align-middle">
            <h1 className="text-4xl font-bold">Bulletin</h1>
            {isAdmin && <LazyAddBulletin />}
          </div>
          <Separator className="my-4 w-full" />
          {!isAdmin && <BulletinFeed groups={userGroups} />}
          {isAdmin && <AdminBulletin />}
        </Authenticated>
      </main>
    </div>
  );
}
