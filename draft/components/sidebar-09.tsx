"use client";

import * as React from "react";
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  Command,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react";
import { ThemeProvider } from "next-themes";

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Label } from "./ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar";
import { Switch } from "./ui/switch";
import { ChatContainer } from "./ChatContainer";
import { SidebarNavigation } from "./SidebarNavigation";
import { TrashContent } from "./TrashContent";
import { ThemeToggle } from "./ThemeToggle";

// Sample data for chat archive
const data = {
  user: {
    name: "Alex Chen",
    email: "alex@example.com",
    avatar: "/avatars/alex.jpg",
  },
  chats: [
    {
      id: "chat-1",
      title: "Website Optimization Analysis",
      lastMessage:
        "Here's a detailed breakdown of potential performance improvements for your website...",
      timestamp: "2:34 PM",
      preview:
        "Based on the analysis of your current website architecture, I've identified several key areas where we can optimize performance. The main bottlenecks appear to be...",
      model: "Claude-3",
      messageCount: 24,
    },
    {
      id: "chat-2",
      title: "Python Data Processing Script",
      lastMessage:
        "The modified script now handles JSON inputs more efficiently...",
      timestamp: "11:15 AM",
      preview:
        "I've updated the data processing pipeline to include error handling and better memory management. Here's the revised code...",
      model: "Claude-3",
      messageCount: 15,
    },
    {
      id: "chat-3",
      title: "Marketing Strategy Review",
      lastMessage: "These are the key metrics we should focus on...",
      timestamp: "Yesterday",
      preview:
        "Based on your target audience and goals, I recommend focusing on these key performance indicators...",
      model: "Claude-3",
      messageCount: 32,
    },
  ],
};

export default function Page() {
  const [activeContent, setActiveContent] = React.useState<"inbox" | "trash">(
    "inbox"
  );
  const [selectedChat, setSelectedChat] = React.useState<
    (typeof data.chats)[0] | null
  >(null);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "350px",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          setActiveContent={setActiveContent}
          setSelectedChat={setSelectedChat}
        />
        <SidebarInset className="flex flex-col h-[calc(100vh-64px)]">
          {activeContent === "inbox" ? (
            <ChatContainer selectedArchivedChat={selectedChat} />
          ) : (
            <TrashContent />
          )}
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  );
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  setActiveContent: (content: "inbox" | "trash") => void;
  setSelectedChat: (chat: (typeof data.chats)[0] | null) => void;
}

function AppSidebar({
  setActiveContent,
  setSelectedChat,
  ...props
}: AppSidebarProps) {
  const [chats] = React.useState(data.chats);
  const { setOpen } = useSidebar();

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
      {...props}
    >
      <Sidebar
        collapsible="none"
        className="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarTrigger>
                <SidebarMenuButton size="lg" className="md:h-8 md:p-0">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Command className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">ChatArchive</span>
                    <span className="truncate text-xs">Personal</span>
                  </div>
                </SidebarMenuButton>
              </SidebarTrigger>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNavigation
            setActiveContent={setActiveContent}
            setOpen={setOpen}
          />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={data.user} />
        </SidebarFooter>
      </Sidebar>

      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-base font-medium text-foreground">
              Chat Archive
            </div>
            <div className="flex items-center space-x-2">
              <Label className="flex items-center gap-2 text-sm">
                <span>Favorites</span>
                <Switch className="shadow-none" />
              </Label>
              <ThemeToggle />
            </div>
          </div>
          <SidebarInput placeholder="Search conversations..." />
        </SidebarHeader>
        <SidebarContent>
          <div className="px-0">
            {chats.map((chat) => (
              <button
                key={chat.id}
                className="w-full text-left flex flex-col items-start gap-2 whitespace-nowrap border-b p-4 text-sm leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => {
                  setSelectedChat(chat);
                  setOpen(true);
                }}
              >
                <div className="flex w-full items-center gap-2">
                  <span className="font-medium">{chat.title}</span>
                  <span className="ml-auto text-xs">{chat.timestamp}</span>
                </div>
                <div className="flex w-full items-center gap-2 text-xs text-muted-foreground">
                  <span>{chat.model}</span>
                  <span>•</span>
                  <span>{chat.messageCount} messages</span>
                </div>
                <span className="line-clamp-2 w-[260px] whitespace-break-spaces text-xs">
                  {chat.preview}
                </span>
              </button>
            ))}
          </div>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  );
}

function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground md:h-8 md:p-0"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">AC</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">AC</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheck className="mr-2 h-4 w-4" />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
