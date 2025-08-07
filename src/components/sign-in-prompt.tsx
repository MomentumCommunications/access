import { ShieldOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";

export function SignInPrompt() {
  return (
    <Alert variant="default">
      <ShieldOff />
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>
        More features available if you sign up.
        <Button asChild className="w-min cursor-pointer">
          <a href="/sign-up">Sign up</a>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
