import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
} from "./ui/sidebar";
import { useZustandTheme } from "../store";
import { useRightSidebar } from "../contexts/RightSidebarContext";

export function RightSidebar() {
  const { theme } = useZustandTheme();
  const { isOpen, setIsOpen } = useRightSidebar();

  return (
    <SidebarProvider open={isOpen} onOpenChange={setIsOpen}>
      <Sidebar
        side="right"
        collapsible="offcanvas"
        className="hidden md:flex"
        style={
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            "--sidebar-width": "200px",
          } as React.CSSProperties
        }
      >
        <SidebarHeader
          className="border-b p-4"
          style={{ borderColor: theme.border }}
        >
          <div className="text-base font-medium">Details</div>
        </SidebarHeader>
        <SidebarContent>
          <div className="p-4">
            <h3 className="text-sm font-medium mb-2">Current Chat</h3>
            <div className="text-sm" style={{ color: theme.textSecondary }}>
              Select a chat to view details
            </div>
          </div>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
