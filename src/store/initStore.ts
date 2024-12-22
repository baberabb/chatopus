import { Theme, ThemeType, ModelConfig, ProviderType, ProviderSettings } from '../types';

import { providerConfigs } from "../config/providers";

const defaultModelConfig: ModelConfig = {
  active_provider: "anthropic",
  providers: Object.fromEntries(
    Object.entries(providerConfigs).map(([provider, config]) => [
      provider,
      {
        api_key: "",
        model: config.models[0],
        parameters: Object.fromEntries(
          Object.entries(config.parameters).map(([key, param]) => [
            key,
            param.default
          ])
        ),
        customParameters: {},
      }
    ])
  ) as Record<ProviderType, ProviderSettings>,
};

export const themes: Record<ThemeType, Theme> = {
  light: {
    background: "#FFFFFF",
    surface: "#F5F5F5",
    border: "#E6E6E6",
    text: "#333333",
    textSecondary: "#757575",
    shadowColor: "rgba(0, 0, 0, 0.1)",
  },
  dark: {
    background: "#2C3E50",
    surface: "#34495E",
    border: "#4A5568",
    text: "#E2E8F0",
    textSecondary: "#A0AEC0",
    shadowColor: "rgba(0, 0, 0, 0.2)",
  },
};

export const initializeStore = async () => {
  // Theme initialization
  const getInitialTheme = async (): Promise<ThemeType> => {
    try {
      const savedTheme = localStorage.getItem("theme") as ThemeType | null;
      if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme;
      }
    } catch (error) {
      console.warn("Failed to read theme from localStorage:", error);
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  // Model config initialization
  const getInitialModelConfig = async (): Promise<ModelConfig> => {
    try {
      const savedConfig = localStorage.getItem("model_config");
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig) as ModelConfig;
        // Ensure parameters and customParameters exist for each provider
        const providers = Object.entries(parsedConfig.providers).reduce<Record<ProviderType, ProviderSettings>>((acc, [provider, settings]) => {
          acc[provider as ProviderType] = {
            api_key: settings.api_key || "",
            model: settings.model || providerConfigs[provider].models[0],
            parameters: settings.parameters || {},
            customParameters: settings.customParameters || {},
          };
          return acc;
        }, {} as Record<ProviderType, ProviderSettings>);
        
        return {
          active_provider: parsedConfig.active_provider,
          providers,
        };
      }
    } catch (error) {
      console.warn("Failed to read model config from localStorage:", error);
    }
    return defaultModelConfig;
  };

  const [initialTheme, initialModelConfig] = await Promise.all([
    getInitialTheme(),
    getInitialModelConfig(),
  ]);

  return {
    theme: {
      type: initialTheme,
      values: themes[initialTheme],
    },
    modelConfig: initialModelConfig,
  };
};
