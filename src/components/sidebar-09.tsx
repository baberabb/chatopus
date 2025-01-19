import * as React from "react";
import { Command, Plus, Trash2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./ui/sidebar";
import { ChatContainer } from "./chat/ChatContainer";
import { RightSidebar } from "./RightSidebar";
import { TrashContent } from "./TrashContent";
import Settings from "./settings/Settings";
import { ModelSettings } from "./settings/ModelSettings";
import { useZustandTheme, useChatStore } from "../store";
import { Conversation } from "../types";
import ErrorBoundary from "./ErrorBoundary";
import { formatContentBlocks } from "./chat/utils";

// Navigation data structure
const data = {
  navMain: [
    {
      title: "Chats",
      url: "#",
      items: [] as Conversation[], // Will be populated with conversations
    },
    {
      title: "Settings",
      url: "#",
      items: [
        {
          title: "Model Settings",
          url: "#model",
        },
        {
          title: "App Settings",
          url: "#settings",
        },
      ],
    },
  ],
};

export default function Page() {
  const [activeContent, setActiveContent] = React.useState<
    "inbox" | "trash" | "settings" | "model"
  >("inbox");
  const { theme } = useZustandTheme();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "19rem",
          backgroundColor: theme.background,
          color: theme.text,
          "--border-color": theme.border,
        } as React.CSSProperties
      }
    >
      <ErrorBoundary>
        <AppSidebar />
      </ErrorBoundary>
      <SidebarInset>
        <div className="flex flex-1 flex-col">
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
          <RightSidebar />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { theme } = useZustandTheme();
  const conversations = useChatStore((state) => state.conversations);
  const currentConversationId = useChatStore(
    (state) => state.currentConversationId
  );
  const isLoading = useChatStore((state) => state.isLoading);
  const error = useChatStore((state) => state.error);
  const initialized = useChatStore((state) => state.initialized);
  const setCurrentConversationId = useChatStore(
    (state) => state.setCurrentConversationId
  );
  const loadConversations = useChatStore((state) => state.loadConversations);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const createConversation = useChatStore((state) => state.createConversation);

  // Load conversations on mount
  React.useEffect(() => {
    loadConversations();
  }, []);

  // Update navigation data with conversations
  React.useEffect(() => {
    if (conversations) {
      data.navMain[0].items = conversations;
    }
  }, [conversations]);

  // Show loading state while store is initializing
  if (!isLoading && !initialized) {
    return (
      <Sidebar variant="floating" {...props}>
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
        </div>
      </Sidebar>
    );
  }

  const handleChatSelect = async (chatId: number) => {
    try {
      await setCurrentConversationId(chatId);
    } catch (err) {
      console.error("Error loading conversation:", err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, chatId: number) => {
    e.stopPropagation();
    try {
      await deleteConversation(chatId);
      if (currentConversationId === chatId) {
        const newId = await createConversation();
        await setCurrentConversationId(newId);
      }
    } catch (err) {
      console.error("Error deleting conversation:", err);
    }
  };

  const handleNewChat = async () => {
    try {
      const newId = await createConversation();
      await setCurrentConversationId(newId);
    } catch (err) {
      console.error("Error creating new chat:", err);
    }
  };

  return (
    <Sidebar variant="floating" {...props}>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Command className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-semibold">ChatArchive</span>
            <span className="">v1.0.0</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-2">
            {data.navMain.map((section) => (
              <SidebarMenuItem key={section.title}>
                <SidebarMenuButton asChild>
                  <div className="font-medium flex justify-between items-center w-full">
                    {section.title}
                    {section.title === "Chats" && (
                      <button
                        onClick={handleNewChat}
                        className="flex items-center gap-1 text-sm px-2 py-1 rounded hover:bg-sidebar-accent transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        New
                      </button>
                    )}
                  </div>
                </SidebarMenuButton>
                {section.items?.length ? (
                  <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
                    {section.items.map((item: any) => (
                      <SidebarMenuSubItem key={item.id || item.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={item.id === currentConversationId}
                          onClick={() => item.id && handleChatSelect(item.id)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>
                              {item.id
                                ? formatContentBlocks(item.title) || "New Chat"
                                : item.title}
                            </span>
                            {item.id && (
                              <button
                                onClick={(e) => handleDelete(e, item.id)}
                                className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                                title="Delete conversation"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
