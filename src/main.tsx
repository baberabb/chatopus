import * as React from "react";
import { useEffect, useState, type FC } from "react";
import { createRoot } from "react-dom/client";
import DiscordLikeChat from "@/components/Chatbox";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
import Settings from "@/components/Settings";
import { useZustandTheme } from "@/store";
import Model from "@/components/ModelSettings";

const AppLayout: FC = () => {
  const [currentView, setCurrentView] = useState<"chat" | "settings" | "model">(
    "chat"
  );
  const { theme } = useZustandTheme();

  useEffect(() => {
    document.body.style.backgroundColor = theme.background;
    document.body.style.color = theme.text;
  }, [theme]);

  return (
    <div
      className="h-screen w-full"
      style={{ backgroundColor: theme.background, color: theme.text }}
    >
      <div className="flex flex-grow flex-col">
        <main className="flex-grow overflow-hidden">
          {currentView === "chat" && <DiscordLikeChat />}
          {currentView === "settings" && <Settings />}
          {currentView === "model" && <Model />}
        </main>
      </div>
    </div>
  );
};

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <React.StrictMode>
    <TooltipProvider>
      <AppLayout />
    </TooltipProvider>
  </React.StrictMode>
);
