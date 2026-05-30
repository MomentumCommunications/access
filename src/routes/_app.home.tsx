import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Authenticated, Unauthenticated } from "convex/react";
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

export const Route = createFileRoute("/_app/home")({
  component: Home,
});

function Home() {
  // TODO: change array indexed passkeys to be more dynamic
  const { data: userData, isLoading } = useCurrentUser();

  const role = userData?.role;

  const userGroups = userData?.group || [];

  console.log(userGroups);

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
            {role === "admin" && <LazyAddBulletin />}
          </div>
          <Separator className="my-4 w-full" />
          {role !== "admin" && <BulletinFeed groups={userGroups} />}
          {role === "admin" && <AdminBulletin />}
        </Authenticated>
      </main>
    </div>
  );
}
