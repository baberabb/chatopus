import React, { createContext, useState, useContext, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Model {
  id: string;
  name: string;
}

interface ModelContextType {
  currentModel: Model | null;
  setCurrentModel: (model: Model) => void;
  models: Model[];
  loadSavedModels: () => Promise<void>;
  saveModel: (model: Model) => Promise<void>;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export const ModelProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentModel, setCurrentModel] = useState<Model | null>(null);
  const [models, setModels] = useState<Model[]>([]);

  const loadSavedModels = async () => {
    try {
      const config = await invoke<any>("get_config");
      const activeProvider = config.active_provider;
      const providerSettings = config.providers[activeProvider];

      // Set current model from config
      setCurrentModel({
        id: providerSettings.model,
        name: providerSettings.model,
      });

      // Set available models (for now just the current one)
      setModels([
        {
          id: providerSettings.model,
          name: providerSettings.model,
        },
      ]);
    } catch (error) {
      console.error("Error loading config:", error);
    }
  };

  const saveModel = async (model: Model) => {
    try {
      const config = await invoke<any>("get_config");
      const activeProvider = config.active_provider;
      const providerSettings = config.providers[activeProvider];

      await invoke("update_provider_settings", {
        provider: activeProvider,
        settings: {
          ...providerSettings,
          model: model.id,
        },
      });

      setCurrentModel(model);
    } catch (error) {
      console.error("Error saving model:", error);
    }
  };

  useEffect(() => {
    void loadSavedModels();
  }, []);

  return (
    <ModelContext.Provider
      value={{
        currentModel,
        setCurrentModel,
        models,
        loadSavedModels,
        saveModel,
      }}
    >
      {children}
    </ModelContext.Provider>
  );
};

export const useModel = () => {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error("useModel must be used within a ModelProvider");
  }
  return context;
};
