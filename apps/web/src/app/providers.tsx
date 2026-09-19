"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { LiveAnnouncer } from "@/components/live-announcer";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000 } },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <LiveAnnouncer />
    </QueryClientProvider>
  );
}
