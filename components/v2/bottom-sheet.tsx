"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

// The redesign's bottom sheet: a rounded panel that rises from the bottom edge
// with a drag handle you can flick down to dismiss. Same Base UI dialog
// primitive (and therefore the same focus trap / escape / backdrop semantics)
// as components/ui/dialog.tsx — only the position and the gesture differ.

function BottomSheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="bottom-sheet" {...props} />;
}

function BottomSheetContent({
  className,
  children,
  title,
  meta,
  ...props
}: DialogPrimitive.Popup.Props & {
  // Rendered as the sheet's serif title next to an optional right-hand caption.
  title: string;
  meta?: string;
}) {
  const popupRef = React.useRef<HTMLDivElement>(null);

  // Drag the handle: follow the finger down, spring back under ~90px, close
  // past it. Upward drag is damped rather than blocked so the sheet feels
  // physical at the top of its travel.
  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const handle = e.currentTarget;
    const sheet = popupRef.current;
    if (!sheet) return;
    handle.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    let dy = 0;

    const move = (ev: PointerEvent) => {
      dy = ev.clientY - y0;
      sheet.style.transition = "none";
      sheet.style.transform = `translateY(${dy > 0 ? dy : Math.max(dy * 0.25, -40)}px)`;
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      sheet.style.transition = "transform .26s cubic-bezier(.22,1,.36,1)";
      sheet.style.transform = "translateY(0)";
      if (dy > 90) {
        // Let the spring-back start before the exit animation takes over.
        sheet.querySelector<HTMLButtonElement>("[data-sheet-dismiss]")?.click();
      }
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up, { once: true });
    handle.addEventListener("pointercancel", up, { once: true });
  }

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="bottom-sheet-overlay"
        className="fixed inset-0 isolate z-50 bg-[rgba(18,23,29,.34)] duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        ref={popupRef}
        data-slot="bottom-sheet-content"
        className={cn(
          "bg-card text-ink fixed inset-x-2 bottom-0 z-50 flex max-h-[86dvh] flex-col rounded-t-[26px] px-5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-[0_-12px_32px_-18px_rgba(18,23,29,.35)] duration-200 outline-none data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2",
          className
        )}
        {...props}
      >
        {/* Grab handle */}
        <div
          onPointerDown={onHandlePointerDown}
          className="flex-none cursor-grab touch-none pt-2.5 pb-3"
        >
          <div className="bg-warm-border mx-auto h-1 w-[38px] rounded-full" />
        </div>

        <div className="flex flex-none items-baseline gap-2.5 pb-3.5">
          <DialogPrimitive.Title className="font-serif text-[21px] leading-none font-medium tracking-[-0.01em]">
            {title}
          </DialogPrimitive.Title>
          <span className="flex-1" />
          {meta && (
            <span className="text-faint text-xs whitespace-nowrap">{meta}</span>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>

        {/* The drag gesture closes through this — a real Close so Base UI runs
            its own unmount/restore-focus path. */}
        <DialogPrimitive.Close
          data-sheet-dismiss
          tabIndex={-1}
          aria-hidden
          className="hidden"
        />
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function BottomSheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="bottom-sheet-close" {...props} />;
}

export { BottomSheet, BottomSheetClose, BottomSheetContent };
