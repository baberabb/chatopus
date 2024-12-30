import * as React from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "./components/ui/tooltip";
import "./globals.css";
import { useZustandTheme, useModelStore } from "./store";
import { ModelProvider } from "./contexts/ModelContext";

const SidebarLayout = React.lazy(() => import("./components/sidebar-09"));

const LoadingFallback = () => (
  <div className="h-screen w-full flex items-center justify-center">
    <div className="animate-pulse">Loading...</div>
  </div>
);

const App = () => {
  const { theme, initialized: themeInitialized } = useZustandTheme();
  const { initialized: modelInitialized } = useModelStore();

  React.useEffect(() => {
    if (themeInitialized) {
      document.body.style.backgroundColor = theme.background;
      document.body.style.color = theme.text;
    }
  }, [theme, themeInitialized]);

  if (!themeInitialized || !modelInitialized) {
    return <LoadingFallback />;
  }

  return (
    <React.Suspense fallback={<LoadingFallback />}>
      <SidebarLayout />
    </React.Suspense>
  );
};

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <React.StrictMode>
    <TooltipProvider>
      <ModelProvider>
        <App />
      </ModelProvider>
    </TooltipProvider>
  </React.StrictMode>,
);

/* Original layout preserved for reference:
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
*/
