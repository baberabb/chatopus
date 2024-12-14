import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { useZustandTheme } from "../store";
import { Separator } from "./ui/separator";

const Settings = () => {
  const { theme, toggleTheme } = useZustandTheme();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6" style={{ color: theme.text }}>
        Settings
      </h2>

      <div className="space-y-6">
        <div className="space-y-6">
          <h3 className="text-xl font-semibold">Appearance</h3>
          <div className="flex items-center justify-between">
            <Label htmlFor="dark-mode" className="text-lg">
              Dark Mode
            </Label>
            <Switch id="dark-mode" onCheckedChange={toggleTheme} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message-font-size" className="text-lg">
              Message Font Size
            </Label>
            <Slider
              id="message-font-size"
              min={12}
              max={24}
              step={1}
              defaultValue={[16]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notification-volume" className="text-lg">
              Notification Volume
            </Label>
            <Slider
              id="notification-volume"
              min={0}
              max={100}
              step={1}
              defaultValue={[50]}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
