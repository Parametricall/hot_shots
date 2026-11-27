import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

type CadenceRow = { data: string; when: string; perDay: string };

export const SYNC_CADENCE: readonly CadenceRow[] = [
  {
    data: "Fixture",
    when: "Hourly in-Season (Games not yet complete). A full reconcile daily. Daily off-Season. A finished Season: never again.",
    perDay: "≤ 25",
  },
  {
    data: "Next year's Fixture",
    when: "Daily, until Squiggle has Games for it",
    perDay: "1",
  },
  {
    data: "Model tips",
    when: "Hourly for Rounds with a Game in the next 7 days, otherwise daily",
    perDay: "≤ 48",
  },
  {
    data: "Ladder",
    when: "10 minutes after a Game completes, plus a daily reconcile in-Season",
    perDay: "≤ 10",
  },
  {
    data: "Teams",
    when: "Weekly, or when a Game names a team the tables don't have (at most hourly)",
    perDay: "< 1",
  },
];

/** What the Squiggle sync fetches, how often, and how many requests that costs a day. */
export const SyncCadenceTable = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Data</TableHead>
        <TableHead>When</TableHead>
        <TableHead>Per day</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {SYNC_CADENCE.map((row) => (
        <TableRow key={row.data}>
          <TableCell className="align-top font-medium">{row.data}</TableCell>
          <TableCell className="align-top whitespace-normal">{row.when}</TableCell>
          <TableCell className="align-top tabular-nums">{row.perDay}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
