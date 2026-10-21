"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

import { DARK_MODE } from "@/lib/flags"
import { useAppearance } from "@/lib/use-appearance"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  // The app's own resolved theme, not next-themes (nothing mounts a
  // ThemeProvider) and not sonner's "system" — that reads prefers-color-scheme,
  // so a manual Light on a dark phone (or the flag being off) would get dark
  // toasts against a light app.
  const { resolved } = useAppearance()
  return (
    <Sonner
      theme={DARK_MODE ? resolved : "light"}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
