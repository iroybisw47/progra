import { ColorSwatches } from "progra";

const noop = () => {};

export function Selected() {
  return (
    <div className="w-full max-w-sm">
      <ColorSwatches value="#4f9b8c" onChange={noop} />
    </div>
  );
}

export function NoneSelected() {
  return (
    <div className="w-full max-w-sm">
      <ColorSwatches value={null} onChange={noop} />
    </div>
  );
}
