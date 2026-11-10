import { useConvexQuery } from "@convex-dev/react-query";
import { api } from "convex/_generated/api";
import { useMemo, useState } from "react";
import {
  attendanceRangeError,
  attendanceReportView,
  defaultAttendanceRange,
  type AttendanceReportSearch,
} from "../../shared/attendance-report";

export function useAttendanceReport(search: AttendanceReportSearch) {
  const [defaults] = useState(defaultAttendanceRange);
  const range = {
    start: search.start ?? defaults.start,
    end: search.end ?? defaults.end,
  };
  const error = attendanceRangeError(range.start, range.end);
  const options = useConvexQuery(api.reports.adminAttendanceReportOptions, {});
  const report = useConvexQuery(
    api.reports.adminAttendanceReport,
    error ? "skip" : range,
  );
  const rows = useMemo(
    () => attendanceReportView(report ?? [], options?.groups ?? [], search),
    [report, options, search],
  );
  return {
    range,
    error,
    options,
    rows,
    loading: !error && (report === undefined || options === undefined),
  };
}
