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

type EmailVerificationFormProps = React.ComponentProps<typeof Card> & {
  email: string;
  error?: string | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
};

export function EmailVerificationForm({
  email,
  error,
  isSubmitting,
  onCancel,
  onSubmit,
  ...props
}: EmailVerificationFormProps) {
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          Enter the verification code sent to {email}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <input name="flow" type="hidden" value="email-verification" />
          <input name="email" type="hidden" value={email} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="code">Verification code</FieldLabel>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </Field>
            {error ? (
              <FieldDescription className="text-destructive">
                {error}
              </FieldDescription>
            ) : null}
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Verifying..." : "Continue"}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
