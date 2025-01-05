import React, { useCallback, useRef } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
} from "./ui/sidebar";
import { useZustandTheme } from "../store";
import { useRightSidebar } from "../contexts/RightSidebarContext";
import { Pin, GripVertical } from "lucide-react";

export function RightSidebar() {
  const { theme } = useZustandTheme();
  const {
    isOpen,
    setIsOpen,
    isPinned,
    setPinned,
    width,
    setWidth,
    onHoverStart,
    onHoverEnd,
  } = useRightSidebar();

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
          className="hidden md:flex transition-transform duration-500 ease-out"
          style={
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              "--sidebar-width": `${width}px`,
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
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize group flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.pageX;
              const startWidth = width;

              const handleMouseMove = (e: MouseEvent) => {
                const delta = startX - e.pageX;
                setWidth(startWidth + delta);
              };

              const handleMouseUp = () => {
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
              };

              document.addEventListener("mousemove", handleMouseMove);
              document.addEventListener("mouseup", handleMouseUp);
            }}
          >
            <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
              <GripVertical className="h-2.5 w-2.5 text-background" />
            </div>
          </div>
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
