import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
} from "./ui/sidebar";
import { useZustandTheme } from "../store";
import { useRightSidebar } from "../contexts/RightSidebarContext";
import { Pin } from "lucide-react";

export function RightSidebar() {
  const { theme } = useZustandTheme();
  const { isOpen, setIsOpen, isPinned, setPinned, onHoverStart, onHoverEnd } =
    useRightSidebar();

  return (
    <>
      <div
        className="fixed top-0 right-0 w-4 h-full z-10 hidden md:flex items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        onMouseEnter={onHoverStart}
        style={{ backgroundColor: `${theme.surface}10` }}
      >
        <div className="w-0.5 h-12 rounded-full bg-gray-200 dark:bg-gray-700 opacity-50" />
      </div>
      <SidebarProvider
        open={isOpen}
        onOpenChange={setIsOpen}
        onMouseLeave={onHoverEnd}
      >
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
            <div className="flex items-center justify-between">
              <div className="text-base font-medium">Details</div>
              <button
                onClick={() => setPinned(!isPinned)}
                className={`p-1.5 rounded-md transition-colors ${
                  isPinned
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
              >
                <Pin className={`w-4 h-4 ${isPinned ? "rotate-45" : ""}`} />
              </button>
            </div>
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
    </>
  );
}
