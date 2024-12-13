import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useZustandTheme } from "@/store";

export function ThemeToggle() {
  const { themeType, toggleTheme } = useZustandTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-8 w-8 px-0"
    >
      {themeType === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
