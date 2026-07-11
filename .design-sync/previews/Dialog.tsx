import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "progra";

export function EditGoal() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit goal</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-title">Title</Label>
            <Input id="goal-title" defaultValue="Finish thesis draft" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-quota">Weekly quota (hours)</Label>
            <Input id="goal-quota" defaultValue="10" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveGoal() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive goal?</DialogTitle>
          <DialogDescription>
            &quot;Learn Spanish&quot; will be hidden from this list. Past
            sessions clocked to it stay logged.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button variant="destructive">Archive</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RecapReady() {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your weekly recap is ready</DialogTitle>
          <DialogDescription>
            18.5h of deep work across 3 goals, and your reading habit held 6
            of 7 days. Take a calm look before planning next week.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button>View recap</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
