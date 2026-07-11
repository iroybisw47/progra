import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "progra";

export function Basic() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Time this week</CardTitle>
        <CardDescription>Mon 6 – Sun 12 Jul</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="font-mono text-3xl tabular-nums">18.5h</div>
        <p className="text-muted-foreground text-sm">
          Deep work across goals, habits, and calendar events.
        </p>
      </CardContent>
    </Card>
  );
}

export function WithAction() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>This week</CardTitle>
        <CardDescription>Your schedule around the calendar.</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          Thesis writing on Tue and Thu mornings; gym after work on Wed.
        </p>
      </CardContent>
    </Card>
  );
}

export function WithFooter() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Sunday recap</CardTitle>
        <CardDescription>A calm look at how the week went.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          You spent 12h on Thesis (quota 10h) and kept your reading habit 6 of
          7 days.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="ghost">
          Share
        </Button>
      </CardFooter>
    </Card>
  );
}

export function Small() {
  return (
    <Card size="sm" className="max-w-sm">
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>Time per goal across months.</CardDescription>
      </CardHeader>
    </Card>
  );
}
