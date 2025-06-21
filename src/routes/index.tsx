import {
  SignedIn,
  SignedOut,
  SignInButton,
  useUser,
} from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useEffect, useState } from "react";
import { AddBulletin } from "~/components/add-bulletin";
import { Header } from "~/components/header";
import MdpBulletin from "~/components/mdp-bulletin";
import Mdp2Bulletin from "~/components/mdp2-bulletin";
import { SignInPrompt } from "~/components/sign-in-prompt";
import { Alert } from "~/components/ui/alert";
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

  const { data: groups } = useQuery(
    convexQuery(api.etcFunctions.getGroups, {}),
  );

  const passwords = groups?.map((group) => group.password);

  const [commonPassword, setCommonPassword] = useState<string | null>(null);
  const [inputPassword, setInputPassword] = useState("");

  // On mount, read stored password
  useEffect(() => {
    const stored = localStorage.getItem("commonPassword");
    if (stored) setCommonPassword(stored);
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

  if (!commonPassword) {
    // Show password input form
    return (
      <div className="flex h-screen flex-col gap-12 justify-center items-center">
        <h1 className="text-4xl font-bold text-center">ACCESS MOMENTUM</h1>
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
              <p>You are signed in</p>
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
            <AddBulletin />
          </div>
          <Separator className="my-4 w-full" />
          {commonPassword === groups?.[0]?.password && <MdpBulletin />}
          {commonPassword === groups?.[1]?.password && <Mdp2Bulletin />}
        </main>
      </div>
    </>
  );
}
