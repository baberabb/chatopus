import React from 'react'
import { ArchiveX, File, Inbox, Send, Trash2 } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navItems = [
  {
    title: "Inbox",
    url: "#",
    icon: Inbox,
    isActive: true,
  },
  {
    title: "Drafts",
    url: "#",
    icon: File,
    isActive: false,
  },
  {
    title: "Sent",
    url: "#",
    icon: Send,
    isActive: false,
  },
  {
    title: "Junk",
    url: "#",
    icon: ArchiveX,
    isActive: false,
  },
  {
    title: "Trash",
    url: "#",
    icon: Trash2,
    isActive: false,
  },
]

interface SidebarNavigationProps {
  setActiveContent: (content: 'inbox' | 'trash') => void
  setOpen: (open: boolean) => void
}

export function SidebarNavigation({ setActiveContent, setOpen }: SidebarNavigationProps) {
  const [activeItem, setActiveItem] = React.useState(navItems[0])

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
                  setActiveItem(item)
                  setOpen(true)
                  if (item.title === 'Trash') {
                    setActiveContent('trash')
                  } else {
                    setActiveContent('inbox')
                  }
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
  )
}

