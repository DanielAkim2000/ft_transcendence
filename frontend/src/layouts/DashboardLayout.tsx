import { Suspense } from "react";
import { Outlet } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { LegalLinks } from "@/components/legal-links";
import { PageFallback } from "@/components/page-fallback";
import { ChessLauncher } from "@/features/chess/ChessLauncher";

export const DashboardLayout = () => {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </div>
          <LegalLinks className="border-t border-border px-4 py-3 md:px-6" />
          <ChessLauncher />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
};
