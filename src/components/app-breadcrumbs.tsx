import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { formatDateTime, formatMDYYYY } from "~/lib/date-utils";
import { getAccountName } from "~/lib/account-name";

type Crumb = {
  href: string;
  label: string;
};

const STATIC_LABELS: Record<string, string> = {
  account: "Account",
  accounts: "Accounts",
  admin: "Admin",
  attendance: "Attendance",
  billing: "Billing",
  charges: "Charges",
  channel: "Channels",
  classes: "Classes",
  create: "Create",
  "create-bulletin": "Create Bulletin",
  directory: "Directory",
  dm: "Messages",
  edit: "Edit",
  help: "Help",
  home: "Home",
  privates: "Privates",
  report: "Report",
  scheduling: "Scheduling",
  search: "Search",
  settings: "Settings",
  staff: "Staff",
  students: "Students",
};

function titleCaseSegment(segment: string) {
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function pathSegmentLabel(segment: string) {
  return STATIC_LABELS[segment] || titleCaseSegment(segment);
}

function isDynamicId(segment: string) {
  return segment.length > 16 || /^[a-z0-9]{12,}$/i.test(segment);
}

function getDynamicIds(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const adminClassId =
    segments[0] === "admin" && segments[1] === "classes"
      ? segments[2]
      : undefined;
  const publicClassId = segments[0] === "classes" ? segments[1] : undefined;
  const adminStudentId =
    segments[0] === "admin" && segments[1] === "students"
      ? segments[2]
      : undefined;
  const memberStudentId = segments[0] === "students" ? segments[1] : undefined;
  const accountId =
    segments[0] === "admin" && segments[1] === "accounts"
      ? segments[2]
      : undefined;
  const attendanceSessionId =
    segments[0] === "staff" && segments[1] === "attendance"
      ? segments[2]
      : undefined;
  const privateId =
    segments[0] === "admin" && segments[1] === "privates"
      ? segments[2]
      : undefined;
  const privateLessonId =
    segments[0] === "admin" && segments[1] === "privates"
      ? segments[3]
      : undefined;

  return {
    accountId: accountId && isDynamicId(accountId) ? accountId : undefined,
    adminClassId:
      adminClassId && isDynamicId(adminClassId) ? adminClassId : undefined,
    adminStudentId:
      adminStudentId && isDynamicId(adminStudentId)
        ? adminStudentId
        : undefined,
    attendanceSessionId:
      attendanceSessionId && isDynamicId(attendanceSessionId)
        ? attendanceSessionId
        : undefined,
    memberStudentId:
      memberStudentId && isDynamicId(memberStudentId)
        ? memberStudentId
        : undefined,
    publicClassId:
      publicClassId && isDynamicId(publicClassId) ? publicClassId : undefined,
    privateId: privateId && isDynamicId(privateId) ? privateId : undefined,
    privateLessonId:
      privateLessonId && isDynamicId(privateLessonId)
        ? privateLessonId
        : undefined,
  };
}

export function AppBreadcrumbs() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const ids = getDynamicIds(pathname);
  const { data: adminClassData } = useQuery(
    convexQuery(
      api.classes.adminGetClass,
      ids.adminClassId
        ? { classId: ids.adminClassId as Id<"classes"> }
        : "skip",
    ),
  );
  const { data: publicClassData } = useQuery(
    convexQuery(
      api.classes.getClassForSignup,
      ids.publicClassId
        ? { classId: ids.publicClassId as Id<"classes"> }
        : "skip",
    ),
  );
  const { data: adminStudentData } = useQuery(
    convexQuery(
      api.classes.adminGetStudent,
      ids.adminStudentId
        ? { student: ids.adminStudentId as Id<"students"> }
        : "skip",
    ),
  );
  const { data: memberStudentData } = useQuery(
    convexQuery(
      api.classes.getMyStudent,
      ids.memberStudentId
        ? { student: ids.memberStudentId as Id<"students"> }
        : "skip",
    ),
  );
  const { data: accountData } = useQuery(
    convexQuery(
      api.classes.adminGetAccount,
      ids.accountId ? { user: ids.accountId as Id<"users"> } : "skip",
    ),
  );
  const { data: attendanceData } = useQuery(
    convexQuery(
      api.classes.staffGetAttendanceSession,
      ids.attendanceSessionId
        ? { session: ids.attendanceSessionId as Id<"sessions"> }
        : "skip",
    ),
  );
  const { data: privateData } = useQuery(
    convexQuery(
      api.privates.getPrivate,
      ids.privateId
        ? { privateId: ids.privateId as Id<"privates"> }
        : "skip",
    ),
  );
  const { data: privateLessonData } = useQuery(
    convexQuery(
      api.privates.getPrivateLesson,
      ids.privateLessonId
        ? {
            privateLessonId:
              ids.privateLessonId as Id<"privateLessons">,
          }
        : "skip",
    ),
  );

  const dynamicLabels: Record<string, string | undefined> = {
    ...(ids.accountId
      ? {
          [ids.accountId]:
            accountData?.account
              ? getAccountName(accountData.account)
              : "Account",
        }
      : {}),
    ...(ids.adminClassId
      ? { [ids.adminClassId]: adminClassData?.classItem.title || "Class" }
      : {}),
    ...(ids.publicClassId
      ? { [ids.publicClassId]: publicClassData?.classItem.title || "Class" }
      : {}),
    ...(ids.adminStudentId
      ? {
          [ids.adminStudentId]: adminStudentData?.student
            ? `${adminStudentData.student.firstName} ${adminStudentData.student.lastName}`
            : "Student",
        }
      : {}),
    ...(ids.memberStudentId
      ? {
          [ids.memberStudentId]: memberStudentData?.student
            ? `${memberStudentData.student.firstName} ${memberStudentData.student.lastName}`
            : "Student",
        }
      : {}),
    ...(ids.attendanceSessionId
      ? {
          [ids.attendanceSessionId]: attendanceData
            ? `${attendanceData.classItem?.title || "Session"} · ${formatMDYYYY(
                attendanceData.session.date,
              )}`
            : "Session",
        }
      : {}),
    ...(ids.privateId
      ? { [ids.privateId]: privateData?.private.name || "Private" }
      : {}),
    ...(ids.privateLessonId
      ? {
          [ids.privateLessonId]: privateLessonData
            ? formatDateTime(privateLessonData.lesson.startsAt)
            : "Lesson",
        }
      : {}),
  };

  const crumbs = buildCrumbs(pathname, dynamicLabels);

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <Breadcrumb className="min-w-0 max-w-[80vw] overflow-hidden">
      <BreadcrumbList className="flex-nowrap overflow-hidden sm:hidden">
        {crumbs.length > 1 ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbEllipsis className="size-6" />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">
            {crumbs.at(-1)?.label}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
      <BreadcrumbList className="hidden flex-nowrap overflow-hidden sm:flex">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <Fragment key={crumb.href}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem className="min-w-0">
                {isLast ? (
                  <BreadcrumbPage className="truncate">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild className="truncate">
                    <Link to={crumb.href as never}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function buildCrumbs(
  pathname: string,
  dynamicLabels: Record<string, string | undefined>,
) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    crumbs.push({
      href,
      label: dynamicLabels[segment] || pathSegmentLabel(segment),
    });
  });

  return crumbs;
}
