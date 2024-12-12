import { ThemeProvider } from "next-themes";
import { SidebarProvider } from "./components/ui/sidebar";
import Page from "./components/sidebar-09";

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="min-h-screen">
        <Page />
      </div>
    </ThemeProvider>
  );
}

export default App;
