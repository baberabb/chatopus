import React, { createContext, useState, useContext, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Model {
  id: string;
  name: string;
  provider: string;
}

interface ModelContextType {
  selectedModels: Model[];
  setSelectedModels: (models: Model[]) => void;
  availableModels: Model[];
  loadAvailableModels: () => Promise<void>;
  saveSelectedModels: (models: Model[]) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export const ModelProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [selectedModels, setSelectedModels] = useState<Model[]>([]);
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize Tauri
  useEffect(() => {
    const init = async () => {
      try {
        // Wait a bit to ensure Tauri is ready
        await new Promise((resolve) => setTimeout(resolve, 100));
        setInitialized(true);
      } catch (error) {
        console.error("Failed to initialize:", error);
        setError("Failed to initialize application");
      }
    };
    init();
  }, []);

  const loadAvailableModels = async () => {
    if (!initialized) {
      console.log("Waiting for initialization...");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log("Loading available models...");

      const config = await invoke<any>("get_config").catch((err) => {
        console.error("Error invoking get_config:", err);
        throw new Error(`Failed to get config: ${err}`);
      });

      if (!config) {
        throw new Error("Config is empty");
      }

      console.log("Received config:", JSON.stringify(config, null, 2));

      if (!config.providers) {
        throw new Error("No providers found in config");
      }

      const models: Model[] = [];

      // Load models from all providers
      Object.entries(config.providers).forEach(
        ([provider, settings]: [string, any]) => {
          console.log(`Processing provider ${provider}:`, settings);

          if (!settings) {
            console.warn(`No settings found for provider ${provider}`);
            return;
          }

          if (
            !settings.available_models ||
            !Array.isArray(settings.available_models)
          ) {
            console.warn(
              `Invalid or missing available_models for provider ${provider}`
            );
            return;
          }

          // Sort models alphabetically
          const providerModels = settings.available_models.sort();
          providerModels.forEach((model: string) => {
            if (typeof model !== "string") {
              console.warn(`Invalid model format for ${provider}:`, model);
              return;
            }
            models.push({
              id: model,
              name: model,
              provider,
            });
          });
        }
      );

      if (models.length === 0) {
        throw new Error("No valid models found in config");
      }

      console.log("Processed available models:", models);
      setAvailableModels(models);

      // Set first model as default if none selected
      if (selectedModels.length === 0 && models.length > 0) {
        console.log("Setting default model:", models[0]);
        await saveSelectedModels([models[0]]);
      }
    } catch (error) {
      console.error("Error loading models:", error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const saveSelectedModels = async (models: Model[]) => {
    try {
      console.log("Saving selected models:", models);
      setSelectedModels(models);
    } catch (error) {
      console.error("Error saving models:", error);
      throw error;
    }
  };

  // Load models when initialized
  useEffect(() => {
    if (initialized) {
      loadAvailableModels();
    }
  }, [initialized]);

  // Debug logging for state changes
  useEffect(() => {
    console.log("Available models updated:", availableModels);
  }, [availableModels]);

  useEffect(() => {
    console.log("Selected models updated:", selectedModels);
  }, [selectedModels]);

  const value = {
    selectedModels,
    setSelectedModels,
    availableModels,
    loadAvailableModels,
    saveSelectedModels,
    loading,
    error,
  };

  console.log("ModelContext rendering with value:", value);

  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
};

export const useModel = () => {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error("useModel must be used within a ModelProvider");
  }
  return context;
};

// Export the Model interface for use in other components
export type { Model };
