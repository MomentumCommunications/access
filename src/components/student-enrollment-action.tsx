import { Link } from "@tanstack/react-router";
import { BookOpen, Mail } from "lucide-react";
import type { Doc } from "convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

type EnrollmentStudent = Pick<
  Doc<"students">,
  "_id" | "firstName" | "lastName" | "status"
>;

export function StudentEnrollmentAction({
  student,
  className,
}: {
  student: EnrollmentStudent;
  className?: string;
}) {
  return (
    <Button asChild className={className}>
      {student.status === "active" ? (
        <Link to="/classes" search={{ student: student._id }}>
          <BookOpen />
          Enroll this student in classes
        </Link>
      ) : (
        <Link
          to="/contact"
          search={{
            topic: "enrollment",
            subject:
              `Request student activation: ${student.firstName} ${student.lastName}`.slice(
                0,
                120,
              ),
          }}
        >
          <Mail />
          Request Activation
        </Link>
      )}
    </Button>
  );
}

export function StudentActivationAlert({
  student,
}: {
  student: EnrollmentStudent;
}) {
  return (
    <Alert>
      <Mail />
      <AlertTitle>Inactive student</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {student.firstName} {student.lastName} is not active. Please contact
          an administrator to reactivate this student before enrolling in
          classes.
        </p>
        <StudentEnrollmentAction student={student} />
      </AlertDescription>
    </Alert>
  );
}
