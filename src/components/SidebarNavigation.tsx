import React from "react";
import {
  ArchiveX,
  File,
  Inbox,
  Send,
  Settings,
  Trash2,
  Cpu,
} from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  {
    title: "Inbox",
    url: "#",
    icon: Inbox,
    isActive: true,
    content: "inbox",
  },
  {
    title: "Drafts",
    url: "#",
    icon: File,
    isActive: false,
    content: "inbox",
  },
  {
    title: "Sent",
    url: "#",
    icon: Send,
    isActive: false,
    content: "inbox",
  },
  {
    title: "Junk",
    url: "#",
    icon: ArchiveX,
    isActive: false,
    content: "inbox",
  },
  {
    title: "Trash",
    url: "#",
    icon: Trash2,
    isActive: false,
    content: "trash",
  },
  {
    title: "Model",
    url: "#",
    icon: Cpu,
    isActive: false,
    content: "model",
  },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
    isActive: false,
    content: "settings",
  },
];

interface SidebarNavigationProps {
  setActiveContent: (content: "inbox" | "trash" | "settings" | "model") => void;
  setOpen: (open: boolean) => void;
}

export function SidebarNavigation({
  setActiveContent,
  setOpen,
}: SidebarNavigationProps) {
  const [activeItem, setActiveItem] = React.useState(navItems[0]);

  return (
    <SidebarGroup>
      <SidebarGroupContent className="px-1.5 md:px-0">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={{
                  children: item.title,
                  hidden: false,
                }}
                onClick={() => {
                  setActiveItem(item);
                  setOpen(true);
                  setActiveContent(
                    item.content as "inbox" | "trash" | "settings" | "model"
                  );
                }}
                isActive={activeItem.title === item.title}
                className="px-2.5 md:px-2"
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
