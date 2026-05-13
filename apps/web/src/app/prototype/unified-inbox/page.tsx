import { Suspense } from "react";
import InboxShell from "./InboxShell";

export default function Page() {
  return (
    <Suspense>
      <InboxShell />
    </Suspense>
  );
}
