import { ShieldOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { SignInButton } from "@clerk/tanstack-react-start";
import { Button } from "./ui/button";

export function SignInPrompt() {
  return (
    <Alert variant="default">
      <ShieldOff />
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>
        More features available if you sign in
        <Button asChild className="w-min cursor-pointer">
          <SignInButton />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
