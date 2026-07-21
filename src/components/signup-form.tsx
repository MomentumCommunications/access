import { Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { PasswordInput } from "~/components/password-input";

type SignupFormProps = Omit<React.ComponentProps<typeof Card>, "onSubmit"> & {
  error?: string | null;
  isSubmitting?: boolean;
  email?: string;
  lockEmail?: boolean;
  redirect?: string;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
};

export function SignupForm({
  error,
  isSubmitting,
  email,
  lockEmail,
  redirect,
  onSubmit,
  ...props
}: SignupFormProps) {
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your email and choose a password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <input name="flow" type="hidden" value="signUp" />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                defaultValue={email}
                readOnly={lockEmail}
                required
              />
              <FieldDescription>
                We&apos;ll use this to contact you. We will not share your email
                with anyone else.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <PasswordInput id="password" name="password" required />
              <FieldDescription>
                Must be at least 8 characters long.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirm Password
              </FieldLabel>
              <PasswordInput
                id="confirm-password"
                name="confirmPassword"
                required
              />
              <FieldDescription>Please confirm your password.</FieldDescription>
            </Field>
            {error ? (
              <FieldDescription className="text-destructive">
                {error}
              </FieldDescription>
            ) : null}
            <FieldGroup>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </Button>
                <FieldDescription className="px-6 text-center">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    search={redirect ? { redirect } : undefined}
                  >
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
