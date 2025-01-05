import * as React from "react";
import { Sidebar, SidebarContent, SidebarHeader } from "./ui/sidebar";
import { useZustandTheme } from "../store";

export function RightSidebar() {
  const { theme } = useZustandTheme();

  return (
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
  );
}
