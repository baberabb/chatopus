import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import DiscordLikeChat from "@/components/Chatbox.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import "./globals.css";
import {
  Book,
  Bot,
  Code2,
  LifeBuoy,
  Menu,
  MessageSquare,
  Moon,
  Settings2,
  Share,
  SquareUser,
  Sun,
  Triangle,
} from "lucide-react";
import { Button } from "./components/ui/button";
import Settings from "./components/Settings";
import { useZustandTheme } from "@/store";

interface SidebarProps {
  isOpen: boolean;
  onRouteChange: (route: string) => void;
}
// export const useZustandTheme = () => useThemeStore();

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onRouteChange }) => {
  const { themeType, theme, toggleTheme } = useZustandTheme();

  const routes = [
    { name: "Chat", icon: MessageSquare },
    { name: "Models", icon: Bot },
    { name: "API", icon: Code2 },
    { name: "Documentation", icon: Book },
    { name: "Settings", icon: Settings2 },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-20 flex h-full w-[53px] flex-col border-r transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0`}
      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
    >
      <div className="border-b p-2" style={{ borderColor: theme.border }}>
        <Button variant="outline" size="icon" aria-label="Home">
          <Triangle className="size-5" style={{ fill: theme.text }} />
        </Button>
      </div>
      <nav className="grid gap-1 p-2">
        {routes.map(({ name, icon: Icon }) => (
          <Tooltip key={name}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-lg ${name.toLowerCase() === "chat" ? "bg-muted" : ""}`}
                aria-label={name}
                onClick={() => onRouteChange(name)}
              >
                <Icon className="size-5" style={{ color: theme.text }} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5}>
              {name}
            </TooltipContent>
          </Tooltip>
        ))}
      </nav>
      <nav className="mt-auto grid gap-1 p-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg"
              aria-label="Help"
            >
              <LifeBuoy className="size-5" style={{ color: theme.text }} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={5}>
            Help
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg"
              aria-label="Account"
            >
              <SquareUser className="size-5" style={{ color: theme.text }} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={5}>
            Account
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg"
              aria-label="Toggle Theme"
              onClick={toggleTheme}
            >
              {themeType === "light" ? (
                <Moon className="size-5" style={{ color: theme.text }} />
              ) : (
                <Sun className="size-5" style={{ color: theme.text }} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={5}>
            Toggle Theme
          </TooltipContent>
        </Tooltip>
      </nav>
    </aside>
  );
};

const ToggleButton: React.FC<{
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}> = ({ isOpen, setIsOpen }) => {
  const { theme } = useZustandTheme();
  return (
    <button
      className="lg:hidden fixed top-4 left-4 z-20 p-2 rounded-md"
      onClick={() => setIsOpen(!isOpen)}
      style={{ backgroundColor: theme.surface }}
    >
      <Menu size={24} style={{ color: theme.text }} />
    </button>
  );
};

const Header: React.FC<{ title: string }> = ({ title }) => {
  const { theme } = useZustandTheme();
  return (
    <header
      className="sticky top-0 z-10 flex items-center gap-1 border-b px-4"
      style={{
        backgroundColor: theme.surface,
        borderColor: theme.border,
        height: "53px", // Explicitly set height
        minHeight: "53px", // Ensure minimum height
        maxHeight: "53px", // Prevent growing larger
      }}
    >
      <h1
        className="text-xl font-semibold truncate"
        style={{ color: theme.text }}
      >
        {title}
      </h1>
      <Button variant="outline" size="sm" className="ml-auto gap-1.5 text-sm">
        <Share className="size-3.5" style={{ color: theme.text }} />
        Share
      </Button>
    </header>
  );
};

const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState("chat");
  const { theme } = useZustandTheme();

  const handleRouteChange = (route: string) => {
    setCurrentView(route.toLowerCase());
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    document.body.style.backgroundColor = theme.background;
    document.body.style.color = theme.text;
  }, [theme]);

  return (
    <div
      className="flex h-screen w-full"
      style={{ backgroundColor: theme.background, color: theme.text }}
    >
      <Sidebar isOpen={isSidebarOpen} onRouteChange={handleRouteChange} />
      <ToggleButton isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex flex-grow flex-col lg:pl-[53px]">
        <Header
          title={currentView.charAt(0).toUpperCase() + currentView.slice(1)}
        />
        <main className="flex-grow overflow-hidden">
          {currentView === "chat" && <DiscordLikeChat />}
          {currentView === "settings" && <Settings />}
        </main>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/*<ThemeProvider>*/}
    <TooltipProvider>
      <AppLayout />
    </TooltipProvider>
    {/*</ThemeProvider>*/}
  </React.StrictMode>,
);
