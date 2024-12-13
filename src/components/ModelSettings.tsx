import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface ProviderSettings {
  api_key: string;
  model: string;
  max_tokens: number;
}

interface AppConfig {
  active_provider: string;
  providers: {
    [key: string]: ProviderSettings;
  };
}

export function ModelSettings() {
  const [config, setConfig] = useState<AppConfig>({
    active_provider: "anthropic",
    providers: {
      anthropic: {
        api_key: "",
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 1024,
      },
    },
  });

  useEffect(() => {
    // Load initial config
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const savedConfig = await invoke<AppConfig>("get_config");
      setConfig(savedConfig);
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  };

  const handleProviderChange = async (provider: string) => {
    try {
      await invoke("set_active_provider", { provider });
      setConfig((prev) => ({
        ...prev,
        active_provider: provider,
      }));
    } catch (error) {
      console.error("Failed to update active provider:", error);
    }
  };

  const handleSettingChange = (
    provider: string,
    setting: keyof ProviderSettings,
    value: string | number
  ) => {
    setConfig((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [provider]: {
          ...prev.providers[provider],
          [setting]: value,
        },
      },
    }));
  };

  const saveProviderSettings = async (provider: string) => {
    try {
      const settings = config.providers[provider];
      await invoke("update_provider_settings", { provider, settings });
    } catch (error) {
      console.error("Failed to save provider settings:", error);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <Label>Active Provider</Label>
          <Select
            value={config.active_provider}
            onValueChange={handleProviderChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(config.providers).map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {provider.charAt(0).toUpperCase() + provider.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {Object.entries(config.providers).map(([provider, settings]) => (
          <div
            key={provider}
            className={`space-y-4 ${
              provider === config.active_provider ? "" : "opacity-50"
            }`}
          >
            <h3 className="text-lg font-semibold capitalize">
              {provider} Settings
            </h3>

            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={settings.api_key}
                onChange={(e) =>
                  handleSettingChange(provider, "api_key", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={settings.model}
                onChange={(e) =>
                  handleSettingChange(provider, "model", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                value={settings.max_tokens}
                onChange={(e) =>
                  handleSettingChange(
                    provider,
                    "max_tokens",
                    parseInt(e.target.value)
                  )
                }
              />
            </div>

            <Button
              onClick={() => saveProviderSettings(provider)}
              disabled={provider !== config.active_provider}
            >
              Save {provider} Settings
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
