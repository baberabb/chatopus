import * as React from "react";
import { BadgeCheck, Bell, Command, LogOut, Sparkles } from "lucide-react";
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
import Settings from "./Settings";
import { ModelSettings } from "./ModelSettings";
import { ThemeToggle } from "./ThemeToggle";
import { CaretSortIcon, ComponentPlaceholderIcon } from "@radix-ui/react-icons";
import { useZustandTheme, useChatStore } from "../store";
import { invoke } from "@tauri-apps/api/core";

const data = {
  user: {
    name: "Alex Chen",
    email: "alex@example.com",
    avatar: "/avatars/alex.jpg",
  },
};

export default function Page() {
  const [activeContent, setActiveContent] = React.useState<
    "inbox" | "trash" | "settings" | "model"
  >("inbox");
  const { theme } = useZustandTheme();

  return (
    <SidebarProvider
      defaultOpen={false}
      style={
        {
          "--sidebar-width": "350px",
          backgroundColor: theme.background,
          color: theme.text,
          "--border-color": theme.border,
        } as React.CSSProperties
      }
    >
      <AppSidebar setActiveContent={setActiveContent} />
      <SidebarInset className="flex flex-col h-[calc(100vh-64px)]">
        {activeContent === "inbox" ? (
          <ChatContainer />
        ) : activeContent === "trash" ? (
          <TrashContent />
        ) : activeContent === "model" ? (
          <div className="p-6 max-w-2xl mx-auto">
            <h2
              className="text-2xl font-bold mb-6"
              style={{ color: theme.text }}
            >
              Model Settings
            </h2>
            <ModelSettings />
          </div>
        ) : (
          <Settings />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  setActiveContent: (content: "inbox" | "trash" | "settings" | "model") => void;
}

function AppSidebar({ setActiveContent, ...props }: AppSidebarProps) {
  const { setOpen } = useSidebar();
  const { theme } = useZustandTheme();
  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    setConversations,
  } = useChatStore();
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Load conversations
  React.useEffect(() => {
    const loadConversations = async () => {
      try {
        setIsLoading(true);
        const convos = await invoke<any[]>("get_conversations");
        setConversations(convos);
      } catch (err: any) {
        console.error("Error loading conversations:", err);
        setError(err?.message || "Failed to load conversations");
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, [setConversations]);

  const handleChatSelect = async (chatId: string) => {
    try {
      await invoke("load_conversation_messages", {
        conversationId: parseInt(chatId, 10),
      });
      setCurrentConversationId(chatId);
      setOpen(true);
    } catch (err: any) {
      console.error("Error loading conversation:", err);
      setError(err?.message || "Failed to load conversation");
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
      {...props}
    >
      <Sidebar
        collapsible="none"
        className="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r"
        style={{
          backgroundColor: theme.surface,
          borderColor: theme.border,
        }}
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

      <Sidebar
        collapsible="none"
        className="hidden flex-1 md:flex"
        style={{
          backgroundColor: theme.surface,
          borderColor: theme.border,
        }}
      >
        <SidebarHeader
          className="gap-3.5 border-b p-4"
          style={{ borderColor: theme.border }}
        >
          <div className="flex w-full items-center justify-between">
            <div className="text-base font-medium">Chat History</div>
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
            {isLoading ? (
              <div className="flex justify-center items-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
              </div>
            ) : error ? (
              <div className="p-4 text-red-500 text-sm">{error}</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">
                No conversations yet
              </div>
            ) : (
              conversations.map((chat) => (
                <button
                  key={chat.id}
                  className={`w-full text-left flex flex-col items-start gap-2 whitespace-nowrap border-b p-4 text-sm leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                    currentConversationId === chat.id ? "bg-sidebar-accent" : ""
                  }`}
                  onClick={() => handleChatSelect(chat.id)}
                  style={{ borderColor: theme.border }}
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="font-medium">
                      {chat.title || "New Chat"}
                    </span>
                    <span className="ml-auto text-xs">{chat.timestamp}</span>
                  </div>
                  <div
                    className="flex w-full items-center gap-2 text-xs"
                    style={{ color: theme.textSecondary }}
                  >
                    <span>{chat.model}</span>
                    <span>•</span>
                    <span>{chat.messageCount} messages</span>
                  </div>
                  <span
                    className="line-clamp-2 w-[260px] whitespace-break-spaces text-xs"
                    style={{ color: theme.textSecondary }}
                  >
                    {chat.preview}
                  </span>
                </button>
              ))
            )}
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
  const { theme } = useZustandTheme();

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
                <span
                  className="truncate text-xs"
                  style={{ color: theme.textSecondary }}
                >
                  {user.email}
                </span>
              </div>
              <CaretSortIcon className="ml-auto size-4" />
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
                  <span
                    className="truncate text-xs"
                    style={{ color: theme.textSecondary }}
                  >
                    {user.email}
                  </span>
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
                <ComponentPlaceholderIcon className="mr-2 h-4 w-4" />
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
