import { createFileRoute } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const Route = createFileRoute("/_app/help")({
  component: HelpRoute,
});

function HelpRoute() {
  return (
    <div className="container mx-auto max-w-3xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Help</CardTitle>
          <CardDescription>
            Access Momentum is currently focused on bulletins, account settings,
            directory access, and group information.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-4 text-sm">
          <p>
            For help with account access or portal content, contact your system
            administrator. You can report a bug with the link below.
          </p>
          <Button asChild variant="outline">
            <a href="/contact?topic=bug_report">Report a bug</a>
          </Button>
        </CardContent>
      </Card>
      <Card id="install-app" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>Install the App</CardTitle>
          <CardDescription>
            Access Momentum can be added to your home screen from most mobile
            browsers.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-6 text-sm">
          <section className="space-y-2">
            <h2 className="text-foreground text-base font-semibold">
              iPhone or iPad
            </h2>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open Access Momentum in Safari.</li>
              <li>Tap the Share button in the browser toolbar.</li>
              <li>Choose Add to Home Screen.</li>
              <li>
                Leave Add as Web App turned on when iOS offers that option.
              </li>
              <li>Tap Add.</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground text-base font-semibold">Android</h2>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Open Access Momentum in Chrome.</li>
              <li>
                If an Install button appears on the home page, tap it and follow
                the browser prompt.
              </li>
              <li>
                If there is no Install button, open the browser menu and choose
                Add to Home screen or Install app.
              </li>
              <li>Confirm the install.</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-foreground text-base font-semibold">
              After installing
            </h2>
            <p>
              Launch Access Momentum from the home screen icon. It should open
              without the normal browser address bar and feel closer to a native
              app.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
