import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  PlusCircle,
  X,
  Type,
  Hash,
  List,
  ToggleLeft,
  Trash2,
} from "lucide-react";

interface ProviderSettings {
  api_key: string;
  model: string;
  max_tokens: number;
  streaming: boolean;
}

interface AppConfig {
  active_provider: string;
  providers: { [key: string]: ProviderSettings };
}

const APISettings: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>("");

  // Load initial config
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const loadedConfig = await invoke<AppConfig>("get_config");
      setConfig(loadedConfig);
      setActiveProvider(loadedConfig.active_provider);
    } catch (error) {
      console.error("Error loading config:", error);
    }
  };

  const handleProviderSelect = async (provider: string) => {
    try {
      await invoke("set_active_provider", { provider });
      setActiveProvider(provider);
      await loadConfig(); // Reload config to get latest state
    } catch (error) {
      console.error("Error setting active provider:", error);
    }
  };

  const handleSettingsUpdate = async (
    provider: string,
    settings: ProviderSettings
  ) => {
    try {
      await invoke("update_provider_settings", { provider, settings });
      await loadConfig(); // Reload config to get latest state
    } catch (error) {
      console.error("Error updating provider settings:", error);
    }
  };

  const handleApiKeyChange = async (provider: string, apiKey: string) => {
    if (!config) return;

    const currentSettings = config.providers[provider];
    const newSettings: ProviderSettings = {
      ...currentSettings,
      api_key: apiKey,
    };

    await handleSettingsUpdate(provider, newSettings);
  };

  const handleModelChange = async (provider: string, model: string) => {
    if (!config) return;

    const currentSettings = config.providers[provider];
    const newSettings: ProviderSettings = {
      ...currentSettings,
      model: model,
    };

    await handleSettingsUpdate(provider, newSettings);
  };

  const handleMaxTokensChange = async (provider: string, maxTokens: number) => {
    if (!config) return;

    const currentSettings = config.providers[provider];
    const newSettings: ProviderSettings = {
      ...currentSettings,
      max_tokens: maxTokens,
    };

    await handleSettingsUpdate(provider, newSettings);
  };

  const handleStreamingChange = async (
    provider: string,
    streaming: boolean
  ) => {
    if (!config) return;

    const currentSettings = config.providers[provider];
    const newSettings: ProviderSettings = {
      ...currentSettings,
      streaming: streaming,
    };

    await handleSettingsUpdate(provider, newSettings);
  };

  if (!config) {
    return <div>Loading...</div>;
  }

  return (
    <Card className="w-[800px]">
      <CardHeader>
        <CardTitle>API Settings</CardTitle>
        <CardDescription>Configure your API providers</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Label>Providers</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.keys(config.providers).map((provider) => (
              <Button
                key={provider}
                variant={provider === activeProvider ? "default" : "outline"}
                onClick={() => handleProviderSelect(provider)}
                className="flex items-center"
              >
                {provider}
              </Button>
            ))}
          </div>
        </div>

        {activeProvider && (
          <div className="space-y-6">
            <div>
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                value={config.providers[activeProvider].api_key}
                onChange={(e) =>
                  handleApiKeyChange(activeProvider, e.target.value)
                }
                placeholder="Enter your API key"
              />
            </div>

            <div>
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={config.providers[activeProvider].model}
                onChange={(e) =>
                  handleModelChange(activeProvider, e.target.value)
                }
                placeholder="Model name"
              />
            </div>

            <div>
              <Label htmlFor="max-tokens">Max Tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                value={config.providers[activeProvider].max_tokens}
                onChange={(e) =>
                  handleMaxTokensChange(
                    activeProvider,
                    parseInt(e.target.value)
                  )
                }
                placeholder="Maximum tokens"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="streaming">Streaming</Label>
              <Switch
                id="streaming"
                checked={config.providers[activeProvider].streaming}
                onCheckedChange={(checked) =>
                  handleStreamingChange(activeProvider, checked)
                }
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default APISettings;
