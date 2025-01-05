import React, { createContext, useContext, useState, useRef } from "react";

interface RightSidebarContextType {
  isOpen: boolean;
  isPinned: boolean;
  width: number;
  setIsOpen: (open: boolean) => void;
  setPinned: (pinned: boolean) => void;
  setWidth: (width: number) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 300;

const RightSidebarContext = createContext<RightSidebarContextType | undefined>(
  undefined
);

export function RightSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setPinned] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onHoverStart = () => {
    if (!isPinned) {
      // Clear any pending close timeout
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setIsOpen(true);
    }
  };

  const onHoverEnd = () => {
    if (!isPinned) {
      // Set a timeout to close after 150ms
      const timeout = setTimeout(() => {
        setIsOpen(false);
        closeTimeoutRef.current = null;
      }, 1000);
      closeTimeoutRef.current = timeout;
    }
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleSetWidth = (newWidth: number) => {
    setWidth(Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH));
  };

  return (
    <RightSidebarContext.Provider
      value={{
        isOpen,
        isPinned,
        width,
        setIsOpen,
        setPinned,
        setWidth: handleSetWidth,
        onHoverStart,
        onHoverEnd,
      }}
    >
      {children}
    </RightSidebarContext.Provider>
  );
}

export function useRightSidebar() {
  const context = useContext(RightSidebarContext);
  if (context === undefined) {
    throw new Error(
      "useRightSidebar must be used within a RightSidebarProvider"
    );
  }
  return context;
}
