import { Label, Textarea } from "progra";

export function Default() {
  return (
    <div className="w-full max-w-sm">
      <Textarea placeholder="Notes for this session…" />
    </div>
  );
}

export function WithLabel() {
  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      <Label htmlFor="session-notes">Session notes</Label>
      <Textarea
        id="session-notes"
        defaultValue={
          "Finished the results chapter outline. Next: clean up figure 3 and re-run the ablation before Friday's supervisor meeting."
        }
      />
    </div>
  );
}

export function States() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <Textarea disabled defaultValue="Recap locked after the week ends." />
      <Textarea
        aria-invalid="true"
        placeholder="A reflection is required to close the week"
      />
    </div>
  );
}
