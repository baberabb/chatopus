import React, { createContext, useContext, useState } from "react";

interface RightSidebarContextType {
  isOpen: boolean;
  isPinned: boolean;
  setIsOpen: (open: boolean) => void;
  setPinned: (pinned: boolean) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

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

  const onHoverStart = () => {
    if (!isPinned) {
      setIsOpen(true);
    }
  };

  const onHoverEnd = () => {
    if (!isPinned) {
      setIsOpen(false);
    }
  };

  return (
    <RightSidebarContext.Provider
      value={{
        isOpen,
        isPinned,
        setIsOpen,
        setPinned,
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
