"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

interface SidebarContextValue {
  isOpen: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
}

const SidebarContext = React.createContext<SidebarContextValue>({
  isOpen: true,
  setOpen: () => {},
  isMobile: false,
});

export function useSidebar() {
  return React.useContext(SidebarContext);
}

interface SidebarProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  mobileBreakpoint?: number;
}

export function SidebarProvider({
  children,
  defaultOpen = true,
  mobileBreakpoint = 768,
  ...props
}: SidebarProviderProps) {
  const [isOpen, setOpen] = React.useState<boolean>(defaultOpen);
  const [isMobile, setIsMobile] = React.useState<boolean>(false);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mobileBreakpoint]);

  return (
    <SidebarContext.Provider value={{ isOpen, setOpen, isMobile }}>
      <div {...props} className={cn("flex h-full", props.className)}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

const sidebarVariants = cva(
  "relative flex flex-col border-r bg-background transition-[width,margin] duration-200 ease-in-out",
  {
    variants: {
      collapsible: {
        icon: "w-[var(--sidebar-width-icon,64px)] data-[expanded=true]:w-[var(--sidebar-width,240px)]",
        full: "w-[var(--sidebar-width-icon,64px)] data-[expanded=true]:w-[var(--sidebar-width,240px)]",
        none: "w-[var(--sidebar-width,240px)]",
      },
    },
    defaultVariants: {
      collapsible: "none",
    },
  }
);

interface SidebarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sidebarVariants> {}

export function Sidebar({
  className,
  collapsible = "none",
  ...props
}: SidebarProps) {
  const { isOpen } = useSidebar();

  return (
    <aside
      data-expanded={isOpen}
      className={cn(sidebarVariants({ collapsible }), className)}
      {...props}
    />
  );
}

export function SidebarHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function SidebarContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto overflow-x-hidden", className)}
      {...props}
    />
  );
}

export function SidebarFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 mt-auto", className)} {...props} />;
}

export function SidebarInset({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isOpen } = useSidebar();
  return (
    <div
      data-expanded={isOpen}
      className={cn(
        "flex-1 transition-[margin] duration-200 ease-in-out",
        className
      )}
      {...props}
    />
  );
}

export function SidebarMenu({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1", className)} {...props} />;
}

export function SidebarMenuItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-2", className)} {...props} />;
}

interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement | HTMLDivElement> {
  size?: "default" | "lg";
  tooltip?: {
    children: React.ReactNode;
    hidden?: boolean;
  };
  isActive?: boolean;
  asChild?: boolean;
}

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement | HTMLDivElement,
  SidebarMenuButtonProps
>(
  (
    { className, size = "default", tooltip, isActive, asChild, ...props },
    ref
  ) => {
    const Comp = asChild ? "div" : "button";
    const { isOpen } = useSidebar();

    return (
      <Comp
        ref={ref}
        data-state={isActive ? "active" : "inactive"}
        className={cn(
          "group relative flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          size === "lg" && "text-base",
          isActive &&
            "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
          className
        )}
        {...props}
      />
    );
  }
);
SidebarMenuButton.displayName = "SidebarMenuButton";

export function SidebarTrigger({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useSidebar();

  return (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      className={cn(
        "group relative flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function SidebarInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="text"
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
