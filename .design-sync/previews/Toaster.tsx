import { useEffect } from "react";
import { Toaster, toast } from "progra";

export function Toasts() {
  useEffect(() => {
    toast.success("Session saved");
    toast("Calendar synced — 42 events");
  }, []);
  return (
    <div className="w-full">
      <Toaster position="top-center" />
    </div>
  );
}
