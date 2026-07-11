// design-sync bundle entry — the client-safe design-system surface of this
// app. Server-coupled components (those importing app/actions or lib/db
// values) are deliberately absent; see .design-sync/config.json exclusions.
import "./process-shim";

export * from "../components/ui/alert-dialog";
export * from "../components/ui/badge";
export * from "../components/ui/button";
export * from "../components/ui/card";
export * from "../components/ui/checkbox";
export * from "../components/ui/dialog";
export * from "../components/ui/input";
export * from "../components/ui/label";
export * from "../components/ui/separator";
export * from "../components/ui/sonner";
// sonner's imperative API must ship from the SAME module instance the
// bundled Toaster subscribes to, or fired toasts never render.
export { toast } from "sonner";
export * from "../components/ui/tabs";
export * from "../components/ui/textarea";
export * from "../components/bottom-nav";
export * from "../components/category-marker";
export * from "../components/category-picker";
export * from "../components/color-swatches";
export * from "../components/goal-progress";
export * from "../components/page-skeleton";
export * from "../components/week-breakdown";
export * from "../components/week-strip";
