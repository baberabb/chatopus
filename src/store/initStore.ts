import { Theme, ThemeType, ModelConfig } from '../types';

const defaultModelConfig: ModelConfig = {
  active_provider: "anthropic",
  providers: {
    anthropic: {
      api_key: "",
      model: "claude-3-sonnet-20240320",
      max_tokens: 1024,
      streaming: true,
    },
    openai: {
      api_key: "",
      model: "gpt-4-turbo-preview",
      max_tokens: 1024,
      streaming: true,
    },
    openrouter: {
      api_key: "",
      model: "anthropic/claude-3-opus",
      max_tokens: 1024,
      streaming: true,
    },
  },
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
        return JSON.parse(savedConfig);
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
