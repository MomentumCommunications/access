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

type PasswordResetFormProps = Omit<
  React.ComponentProps<typeof Card>,
  "onSubmit"
> & {
  email?: string;
  error?: string | null;
  isSubmitting?: boolean;
  onCancelVerification?: () => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
};

export function PasswordResetForm({
  email,
  error,
  isSubmitting,
  onCancelVerification,
  onSubmit,
  ...props
}: PasswordResetFormProps) {
  const isVerificationStep = email !== undefined;

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>
          {isVerificationStep ? "Choose a new password" : "Reset your password"}
        </CardTitle>
        <CardDescription>
          {isVerificationStep
            ? `Enter the code sent to ${email}.`
            : "Enter your email and we will send you a reset code."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          {isVerificationStep ? (
            <>
              <input name="flow" type="hidden" value="reset-verification" />
              <input name="email" type="hidden" value={email} />
            </>
          ) : (
            <input name="flow" type="hidden" value="reset" />
          )}
          <FieldGroup>
            {isVerificationStep ? (
              <>
                <Field>
                  <FieldLabel htmlFor="code">Reset code</FieldLabel>
                  <Input
                    id="code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-password">New password</FieldLabel>
                  <PasswordInput
                    id="new-password"
                    name="newPassword"
                    autoComplete="new-password"
                    required
                  />
                  <FieldDescription>
                    Must be at least 8 characters long.
                  </FieldDescription>
                </Field>
              </>
            ) : (
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  autoComplete="email"
                  required
                />
              </Field>
            )}
            {error ? (
              <FieldDescription className="text-destructive">
                {error}
              </FieldDescription>
            ) : null}
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? isVerificationStep
                    ? "Resetting..."
                    : "Sending..."
                  : isVerificationStep
                    ? "Reset Password"
                    : "Send Code"}
              </Button>
              {isVerificationStep ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancelVerification}
                >
                  Cancel
                </Button>
              ) : (
                <FieldDescription className="text-center">
                  Remember your password? <Link to="/login">Sign in</Link>
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
