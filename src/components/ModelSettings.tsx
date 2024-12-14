import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModelStore } from "@/store";

const modelOptions = {
  anthropic: [
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
    "claude-2.1",
    "claude-2.0",
  ],
  openai: [
    "gpt-4-turbo-preview",
    "gpt-4-0125-preview",
    "gpt-4",
    "gpt-3.5-turbo",
  ],
  openrouter: [
    "anthropic/claude-3-opus",
    "anthropic/claude-3-sonnet",
    "openai/gpt-4-turbo-preview",
    "google/gemini-pro",
    "meta/llama-3-70b",
  ],
};

export function ModelSettings() {
  const { config, updateProviderSettings, setActiveProvider } = useModelStore();

  const handleProviderChange = async (provider: string) => {
    try {
      await invoke("set_active_provider", { provider });
      setActiveProvider(provider);
    } catch (error) {
      console.error("Failed to update active provider:", error);
    }
  };

  const handleSettingChange = (
    provider: string,
    setting: string,
    value: string | number | boolean
  ) => {
    const currentSettings = config.providers[provider];
    const newSettings = {
      ...currentSettings,
      [setting]: value,
    };
    updateProviderSettings(provider, newSettings);
  };

  const saveProviderSettings = async (provider: string) => {
    try {
      const settings = config.providers[provider];
      await invoke("update_provider_settings", { provider, settings });
    } catch (error) {
      console.error("Failed to save provider settings:", error);
    }
  };

  const renderProviderSettings = (provider: string) => {
    const settings = config.providers[provider];
    const models = modelOptions[provider as keyof typeof modelOptions] || [];

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={settings.api_key}
              onChange={(e) =>
                handleSettingChange(provider, "api_key", e.target.value)
              }
              placeholder={`Enter your ${provider} API key`}
            />
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={settings.model}
              onValueChange={(value) =>
                handleSettingChange(provider, "model", value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div className="flex items-center space-x-2">
            <Switch
              id={`${provider}-streaming`}
              checked={settings.streaming}
              onCheckedChange={(checked) =>
                handleSettingChange(provider, "streaming", checked)
              }
            />
            <Label htmlFor={`${provider}-streaming`}>Enable Streaming</Label>
          </div>

          <Button
            onClick={() => saveProviderSettings(provider)}
            className="w-full mt-4"
          >
            Save Settings
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Model Settings</h2>

        <Tabs defaultValue={config.active_provider} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger
              value="anthropic"
              onClick={() => handleProviderChange("anthropic")}
              className="flex-1"
            >
              Anthropic
            </TabsTrigger>
            <TabsTrigger
              value="openai"
              onClick={() => handleProviderChange("openai")}
              className="flex-1"
            >
              OpenAI
            </TabsTrigger>
            <TabsTrigger
              value="openrouter"
              onClick={() => handleProviderChange("openrouter")}
              className="flex-1"
            >
              OpenRouter
            </TabsTrigger>
          </TabsList>

          <TabsContent value="anthropic" className="mt-6">
            {renderProviderSettings("anthropic")}
          </TabsContent>

          <TabsContent value="openai" className="mt-6">
            {renderProviderSettings("openai")}
          </TabsContent>

          <TabsContent value="openrouter" className="mt-6">
            {renderProviderSettings("openrouter")}
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
