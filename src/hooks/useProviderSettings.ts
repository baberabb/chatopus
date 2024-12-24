import { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { ProviderType, ProviderSettings } from "../types";

export function useProviderSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>("");
  const [settings, setSettings] = useState<Record<string, ProviderSettings>>({});

  const loadConfig = async () => {
    try {
      setLoading(true);
      const config = await invoke<{
        active_provider: string;
        providers: Record<string, ProviderSettings>;
      }>("get_config");
      setSettings(config.providers);
      setActiveProvider(config.active_provider);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  const updateProviderSetting = async (
    provider: ProviderType,
    key: keyof ProviderSettings,
    value: any
  ) => {
    try {
      // Get current settings with fallback to empty object
      const currentSettings = settings[provider] || {
        api_key: "",
        model: "",
        parameters: {},
        customParameters: {},
      };

      // Create new settings object
      const newSettings = {
        ...currentSettings,
        [key]: value,
      };

      // Validate the settings before updating
      if (!newSettings.model) {
        throw new Error("Model is required");
      }
      
      await invoke("update_provider_settings", { provider, settings: newSettings });
      setSettings((prev) => ({
        ...prev,
        [provider]: newSettings,
      }));
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const setProvider = async (provider: ProviderType) => {
    try {
      await invoke("set_active_provider", { provider });
      setActiveProvider(provider);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set provider');
      throw err;
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  return {
    loading,
    error,
    settings,
    activeProvider,
    updateProviderSetting,
    setProvider,
    reloadConfig: loadConfig,
  };
}
