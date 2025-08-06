import { SignedIn, SignedOut, useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useEffect, useState } from "react";
import { AddBulletin } from "~/components/add-bulletin";
import { AdminBulletin } from "~/components/admin-bulletin";
import { Header } from "~/components/header";
import { ProtectedContent } from "~/components/protected-content";
import { SignInPrompt } from "~/components/sign-in-prompt";
import { Button } from "~/components/ui/button";
import { Card, CardDescription, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  // TODO: change array indexed passkeys to be more dynamic
  const { user } = useUser();

  const { data: userData, isLoading } = useQuery(
    convexQuery(api.users.getUserByClerkId, {
      ClerkId: user?.id as string,
    }),
  );

  const role = userData?.role;

  const { data: groups, isLoading: groupsLoading } = useQuery(
    convexQuery(api.etcFunctions.getGroups, {}),
  );

  const passwords = groups?.map((group) => group.password);

  const [commonPassword, setCommonPassword] = useState<string | null>(null);
  const [inputPassword, setInputPassword] = useState("");
  const [checkingStorage, setCheckingStorage] = useState(true);

  // On mount, read stored password
  useEffect(() => {
    const stored = localStorage.getItem("commonPassword");
    if (stored) setCommonPassword(stored);
    setCheckingStorage(false);
  }, []);

  // Validate password (example)
  const validatePassword = (password: string) => {
    return passwords?.includes(password);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validatePassword(inputPassword)) {
      localStorage.setItem("commonPassword", inputPassword);
      setCommonPassword(inputPassword);
    } else {
      alert("Invalid password");
    }
  };

  // Show loading spinner while checking localStorage or loading groups
  if (checkingStorage || groupsLoading) {
    return (
      <div className="flex h-screen flex-col gap-12 justify-center items-center">
        <div className="animate-pulse text-center">loading...</div>
      </div>
    ); // Replace with your spinner component
  }

  if (isLoading) {
    return null;
  }

  if (!commonPassword) {
    // Show password input form
    return (
      <div className="flex h-screen flex-col gap-12 justify-center items-center">
        <div className="fixed top-12 lg:top-32 flex flex-col gap-4 items-center">
          <img
            src="https://original-orca-979.convex.cloud/api/storage/b2424ab8-8361-4320-a463-9b96668dbeaf"
            alt="Access Momentum Logo"
            height={150}
            width={150}
            className="rounded-full"
          />
          <h1 className="lg:text-4xl text-2xl font-bold text-center">
            ACCESS MOMENTUM
          </h1>
        </div>
        <Card className="p-4 h-min">
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
    <>
      <Header currentPage="Home" breadcrumbs={[]} />
      <div className="flex justify-center">
        <main className="max-w-4xl w-full p-4">
          <div className="flex flex-col gap-4 py-4 justify-start">
            <SignedIn>
              <p>Hello {user?.firstName}!</p>
            </SignedIn>
            <SignedOut>
              <div className="py-4">
                <h1 className="text-4xl font-bold text-center">
                  ACCESS MOMENTUM
                </h1>
              </div>
              <SignInPrompt />
            </SignedOut>
          </div>
          <div className="flex align-middle justify-between">
            <h1 className="text-4xl font-bold">Bulletin</h1>
            {role === "admin" && <AddBulletin />}
          </div>
          <Separator className="my-4 w-full" />
          {role !== "admin" && <ProtectedContent password={commonPassword} />}
          {role === "admin" && <AdminBulletin />}
        </main>
      </div>
    </>
  );
}
