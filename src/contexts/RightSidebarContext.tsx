import React, { createContext, useContext, useState } from "react";

interface RightSidebarContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
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

  return (
    <RightSidebarContext.Provider value={{ isOpen, setIsOpen }}>
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
