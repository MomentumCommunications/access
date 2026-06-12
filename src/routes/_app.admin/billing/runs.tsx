import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "~/components/role-gate";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

export const Route = createFileRoute("/_app/admin/billing/runs")({
  component: BillingRunsPage,
});

function BillingRunsPage() {
  return (
    <RoleGate allow="admin">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 lg:p-8">
        <div>
          <h1 className="text-3xl font-bold">Runs</h1>
          <p className="text-muted-foreground">
            Billing runs will collect a selected period into a reviewable,
            exportable batch.
          </p>
        </div>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Billing runs</CardTitle>
            <CardDescription>
              Generated runs will preserve the calculations used at issue time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Households</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No billing runs have been generated.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </RoleGate>
  );
}
