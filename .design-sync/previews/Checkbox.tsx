import { Checkbox, Label } from "progra";

export function States() {
  return (
    <div className="flex items-center gap-4">
      <Checkbox aria-label="Unchecked" />
      <Checkbox defaultChecked aria-label="Checked" />
      <Checkbox disabled aria-label="Disabled" />
      <Checkbox disabled defaultChecked aria-label="Disabled checked" />
    </div>
  );
}

export function WithLabel() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="habit-read" defaultChecked />
        <Label htmlFor="habit-read">Read 20 minutes</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="habit-stretch" />
        <Label htmlFor="habit-stretch">Morning stretch</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="habit-water" defaultChecked />
        <Label htmlFor="habit-water">2L of water</Label>
      </div>
    </div>
  );
}
