import { createFileRoute } from "@tanstack/react-router";
import { Header } from "~/components/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const Route = createFileRoute("/chat/general/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <Header
        currentPage="General"
        breadcrumbs={[
          { title: "Home", url: "/" },
          { title: "Chat", url: "/chat/" },
        ]}
      />
      <div className="flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card Content</p>
          </CardContent>
          <CardFooter>
            <p>Card Footer</p>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
