import { createFileRoute } from "@tanstack/react-router";
import { Container } from "~/components/container";
import { Header } from "~/components/header";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";

export const Route = createFileRoute("/admin/dispatch/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <Header
        breadcrumbs={[
          { title: "Home", url: "/" },
          { title: "Admin", url: "/admin/" },
        ]}
        currentPage="Dispatch"
      />
      <Container>
        <h1 className="text-3xl font-bold">Dispatch</h1>
        <div className="flex w-full flex-grow max-w-7xl pt-6 flex-col gap-6">
          <Tabs defaultValue="mdp">
            <TabsList>
              <TabsTrigger value="mdp">MDP</TabsTrigger>
              <TabsTrigger value="mdp2">MDP2</TabsTrigger>
              <TabsTrigger value="club">CLUB</TabsTrigger>
            </TabsList>
            <TabsContent value="mdp">
              <div className="flex flex-col gap-6 w-full">
                <Card>
                  <CardHeader>
                    <CardTitle>MDP</CardTitle>
                    <CardDescription>
                      Make changes to MDP&apos;s dispatch.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea rows={20} />
                  </CardContent>
                  <CardFooter>
                    <Button>Save changes</Button>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="mdp2">
              <Card>
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>
                    Change your password here. After saving, you&apos;ll be
                    logged out.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div className="grid gap-3">
                    <Label htmlFor="tabs-demo-current">Current password</Label>
                    <Input id="tabs-demo-current" type="password" />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="tabs-demo-new">New password</Label>
                    <Input id="tabs-demo-new" type="password" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button>Save password</Button>
                </CardFooter>
              </Card>
            </TabsContent>
            <TabsContent value="club">
              <Card>
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>
                    Change your password here. After saving, you&apos;ll be
                    logged out.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div className="grid gap-3">
                    <Label htmlFor="tabs-demo-current">Current password</Label>
                    <Input id="tabs-demo-current" type="password" />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="tabs-demo-new">New password</Label>
                    <Input id="tabs-demo-new" type="password" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button>Save password</Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Container>
    </>
  );
}
