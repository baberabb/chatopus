/**
 * sidebar-09.tsx
 *
 * A comprehensive sidebar component that provides navigation, chat history management,
 * and user settings functionality. This component serves as the main navigation
 * interface for the application.
 *
 * Features:
 * - Collapsible sidebar with icon-only and expanded states
 * - Chat history management with conversation listing
 * - User profile and settings dropdown
 * - Theme-aware styling
 */

import * as React from "react";
// Icons
import {
  BadgeCheck,
  Bell,
  Command,
  LogOut,
  Sparkles,
  Trash2,
  Plus,
} from "lucide-react";
import { CaretSortIcon, ComponentPlaceholderIcon } from "@radix-ui/react-icons";

// UI Components
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

// Feature Components
import { ChatContainer } from "./chat/ChatContainer";
import { SidebarNavigation } from "./SidebarNavigation";
import { TrashContent } from "./TrashContent";
import Settings from "./settings/Settings";
import { ModelSettings } from "./settings/ModelSettings";
import { ThemeToggle } from "./ThemeToggle";
import ErrorBoundary from "./ErrorBoundary";

// Store and Types
import {
  useZustandTheme,
  useChatStore,
  useConversations,
  useChatError,
  useChatLoading,
} from "../store";
import { Conversation } from "../types";

// Mock user data - TODO: Replace with real user authentication
const data = {
  user: {
    name: "Alex Chen",
    email: "alex@example.com",
    avatar: "/avatars/alex.jpg",
  },
};

/**
 * Type definitions for the sidebar components
 */
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  setActiveContent: (content: "inbox" | "trash" | "settings" | "model") => void;
}

interface NavUserProps {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}

/**
 * Main page component that renders the sidebar and content area.
 * Manages the active content state and provides theme-aware styling.
 *
 * The layout consists of:
 * 1. A collapsible sidebar with navigation and chat history
 * 2. A main content area that displays one of:
 *    - Chat interface (inbox)
 *    - Trash management
 *    - Model settings
 *    - General settings
 */
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
      <ErrorBoundary>
        <AppSidebar setActiveContent={setActiveContent} />
      </ErrorBoundary>
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

/**
 * AppSidebar component that handles the main navigation and chat history.
 * Manages conversation state and provides chat management functionality.
 *
 * Features:
 * - Loads and displays chat conversations
 * - Handles chat selection and deletion
 * - Creates new conversations
 * - Shows loading and error states
 */
function AppSidebar({ setActiveContent }: AppSidebarProps) {
  const { setOpen } = useSidebar();
  const { theme } = useZustandTheme();

  // Use pre-defined hooks for better performance
  const { conversations, currentConversationId } = useConversations();
  const isLoading = useChatLoading();
  const error = useChatError();
  const initialized = useChatStore((state) => state.initialized);

  // Actions from store
  const {
    setCurrentConversationId,
    loadConversations,
    loadConversation,
    deleteConversation,
    createConversation,
  } = useChatStore();

  // Display a loading spinner while the chat store initializes
  // This prevents any UI flicker or invalid states from being shown
  if (!initialized) {
    return (
      <Sidebar
        collapsible="icon"
        className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
      >
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
        </div>
      </Sidebar>
    );
  }

  // Load conversations when the component mounts
  // This ensures we have the latest chat history available
  React.useEffect(() => {
    loadConversations();
  }, []); // Empty dependency array since loadConversations is stable from store

  /**
   * Handles selecting a chat from the sidebar
   * 1. Sets the selected chat as current
   * 2. Loads its messages
   * 3. Opens the sidebar if it's collapsed
   */
  const handleChatSelect = async (chatId: number) => {
    try {
      // setCurrentConversationId will call loadConversation internally
      await setCurrentConversationId(chatId);
      setOpen(true);
    } catch (err) {
      console.error("Error loading conversation:", err);
      // Error state is already set by the store actions
    }
  };

  /**
   * Handles deleting a chat conversation
   * 1. Prevents event bubbling to avoid selecting the chat
   * 2. Deletes the conversation from the store
   * 3. If deleting current chat, creates a new one
   * 4. Updates the current conversation ID
   */
  const handleDelete = async (e: React.MouseEvent, chatId: number) => {
    e.stopPropagation(); // Prevent chat selection when clicking delete
    try {
      await deleteConversation(chatId);
      // If we're deleting the current conversation, create a new one
      if (currentConversationId === chatId) {
        const newId = await createConversation();
        // No need to call loadConversations since createConversation handles it
        await setCurrentConversationId(newId);
      }
    } catch (err) {
      console.error("Error deleting conversation:", err);
      // Error state is already set by the store actions
    }
  };

  /**
   * Creates a new chat conversation
   * 1. Creates a new conversation in the store
   * 2. Sets it as the current conversation
   * 3. Opens the sidebar to show the new chat
   */
  const handleNewChat = async () => {
    try {
      // Create conversation and update local state
      const newId: number = await createConversation();
      // Now that we know the conversation exists, set it as current
      await setCurrentConversationId(newId);
      // Open the sidebar to show the new conversation
      setOpen(true);
    } catch (err) {
      console.error("Error creating new chat:", err);
      // Error state is already set by store actions
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
    >
      {/* Left sidebar - Contains app navigation and user profile */}
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

      {/* Right sidebar - Contains chat history and conversation management */}
      <Sidebar
        collapsible="none"
        className="hidden flex-1 md:flex"
        style={{
          backgroundColor: theme.surface,
          borderColor: theme.border,
        }}
      >
        {/* Chat history header with actions */}
        <SidebarHeader
          className="gap-3.5 border-b p-4"
          style={{ borderColor: theme.border }}
        >
          <div className="flex w-full items-center justify-between">
            <div className="text-base font-medium">Chat History</div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1 text-sm px-2 py-1 rounded hover:bg-sidebar-accent transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </button>
              <Label className="flex items-center gap-2 text-sm">
                <span>Favorites</span>
                <Switch className="shadow-none" />
              </Label>
              <ThemeToggle />
            </div>
          </div>
          <SidebarInput placeholder="Search conversations..." />
        </SidebarHeader>

        {/* Chat history list with loading/error states */}
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
              conversations.map((chat: Conversation) => (
                <div
                  key={chat.id}
                  className={`group relative w-full text-left border-b last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                    currentConversationId === chat.id ? "bg-sidebar-accent" : ""
                  }`}
                  style={{ borderColor: theme.border }}
                >
                  <div className="w-full p-4">
                    {/* Delete conversation button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(e, chat.id);
                      }}
                      className="absolute left-2 top-4 p-2 hover:text-red-500 transition-colors"
                      title="Delete conversation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    {/* Chat selection button with preview */}
                    <button
                      // TODO: remove padding later
                      className="w-full flex flex-col items-start gap-2 text-left pl-8"
                      onClick={() => handleChatSelect(chat.id)}
                    >
                      <div className="flex w-full items-center gap-2">
                        <span className="font-medium">
                          {chat.title || "New Chat"}
                        </span>
                        <span className="ml-auto text-xs">
                          {chat.timestamp}
                        </span>
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
                  </div>
                </div>
              ))
            )}
          </div>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  );
}

/**
 * NavUser component that displays the user profile and settings dropdown.
 * Provides access to user account settings, billing, notifications, and logout.
 * Adapts its layout based on mobile/desktop view.
 */
function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar();
  const { theme } = useZustandTheme();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          {/* User profile button that triggers dropdown */}
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

          {/* Dropdown menu with user actions */}
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            {/* User profile header in dropdown */}
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

            {/* Upgrade option */}
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />

            {/* Account management options */}
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

            {/* Logout option */}
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
