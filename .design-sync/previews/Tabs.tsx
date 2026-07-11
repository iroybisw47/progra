import { Tabs, TabsContent, TabsList, TabsTrigger } from "progra";

export function Default() {
  return (
    <Tabs defaultValue="goals" className="w-full max-w-sm">
      <TabsList>
        <TabsTrigger value="goals">Goals</TabsTrigger>
        <TabsTrigger value="habits">Habits</TabsTrigger>
        <TabsTrigger value="recap">Recap</TabsTrigger>
      </TabsList>
      <TabsContent value="goals" className="py-4">
        <p className="text-sm">
          Finish thesis draft — 12h of 10h quota this week.
        </p>
      </TabsContent>
      <TabsContent value="habits" className="py-4">
        <p className="text-sm">Reading held 6 of 7 days.</p>
      </TabsContent>
      <TabsContent value="recap" className="py-4">
        <p className="text-sm">18.5h of deep work across 3 goals.</p>
      </TabsContent>
    </Tabs>
  );
}

export function Line() {
  return (
    <Tabs defaultValue="week" className="w-full max-w-sm">
      <TabsList variant="line">
        <TabsTrigger value="week">This week</TabsTrigger>
        <TabsTrigger value="month">This month</TabsTrigger>
        <TabsTrigger value="all">All time</TabsTrigger>
      </TabsList>
      <TabsContent value="week" className="py-4">
        <p className="text-sm text-muted-foreground">
          Mon 6 – Sun 12 Jul: 18.5h clocked, 3 goals on track.
        </p>
      </TabsContent>
      <TabsContent value="month" className="py-4">
        <p className="text-sm text-muted-foreground">
          July so far: 64h clocked across goals and habits.
        </p>
      </TabsContent>
      <TabsContent value="all" className="py-4">
        <p className="text-sm text-muted-foreground">
          412h logged since you started tracking.
        </p>
      </TabsContent>
    </Tabs>
  );
}

export function DisabledTab() {
  return (
    <Tabs defaultValue="clock" className="w-full max-w-sm">
      <TabsList>
        <TabsTrigger value="clock">Clock</TabsTrigger>
        <TabsTrigger value="plan">Plan</TabsTrigger>
        <TabsTrigger value="recap" disabled>
          Recap
        </TabsTrigger>
      </TabsList>
      <TabsContent value="clock" className="py-4">
        <p className="text-sm">
          Deep-work session running: Thesis writing, 00:42:10.
        </p>
      </TabsContent>
      <TabsContent value="plan" className="py-4">
        <p className="text-sm">Nothing planned after 4 pm today.</p>
      </TabsContent>
    </Tabs>
  );
}

export function Vertical() {
  return (
    <Tabs
      orientation="vertical"
      defaultValue="today"
      className="w-full max-w-sm"
    >
      <TabsList>
        <TabsTrigger value="today">Today</TabsTrigger>
        <TabsTrigger value="week">Week</TabsTrigger>
      </TabsList>
      <TabsContent value="today" className="py-4">
        <p className="text-sm">Gym at 6 pm, then 1h of Spanish practice.</p>
      </TabsContent>
      <TabsContent value="week" className="py-4">
        <p className="text-sm">
          Thesis mornings Tue and Thu; calendar synced 2h ago.
        </p>
      </TabsContent>
    </Tabs>
  );
}
