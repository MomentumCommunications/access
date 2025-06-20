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
import { AddBulletin } from "~/components/add-bulletin";
import { Header } from "~/components/header";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { user } = useUser();

  const { data, isPending, error } = useQuery(
    convexQuery(api.bulletins.getBulletins, {}),
  );

  return (
    <>
      <Header currentPage="Home" breadcrumbs={[]} />
      <div className="flex justify-center">
        <main className="max-w-4xl w-full p-4">
          <div className="flex align-middle justify-between">
            <h1 className="text-4xl font-bold">Bulletin</h1>
            <AddBulletin />
          </div>
          <Separator className="my-4 w-full" />
          <div className="flex flex-col gap-4 py-4">
            {isPending && <p>Loading...</p>}
            {error && <p>{error.message}</p>}
            {data &&
              data.map((bulletin) => (
                <Card key={bulletin._id}>
                  <CardHeader>
                    <CardTitle>{bulletin.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{bulletin.body}</p>
                  </CardContent>
                  <CardFooter>
                    <p>{bulletin.author}</p>
                  </CardFooter>
                </Card>
              ))}
          </div>
          <div>
            <h1>Index Route</h1>
            <SignedIn>
              <p>You are signed in</p>
            </SignedIn>
            <SignedOut>
              <p>You are signed out</p>
              <Button asChild className="cursor-pointer">
                <SignInButton />
              </Button>
            </SignedOut>
            <div>Hello {user?.firstName}!</div>
          </div>
        </main>
      </div>
    </>
  );
}
