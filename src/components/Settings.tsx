import { useTheme } from "@/ThemeContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

const Settings = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6" style={{ color: theme.text }}>Settings</h2>

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Label htmlFor="dark-mode" className="text-lg">Dark Mode</Label>
                    <Switch
                        id="dark-mode"
                        onCheckedChange={toggleTheme}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="message-font-size" className="text-lg">Message Font Size</Label>
                    <Slider
                        id="message-font-size"
                        min={12}
                        max={24}
                        step={1}
                        defaultValue={[16]}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="notification-volume" className="text-lg">Notification Volume</Label>
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
    );
};

export default Settings;