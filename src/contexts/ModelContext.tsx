import React, { createContext, useState, useContext, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";

interface Model {
    id: string;
    name: string;
    // Add any other properties specific to your models
}

interface ModelContextType {
    currentModel: Model | null;
    setCurrentModel: (model: Model) => void;
    models: Model[];
    loadSavedModels: () => Promise<void>;
    saveModel: (model: Model) => Promise<void>;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export const ModelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentModel, setCurrentModel] = useState<Model | null>(null);
    const [models, setModels] = useState<Model[]>([]);

    const loadSavedModels = async () => {
        try {
            // Placeholder: Replace with actual call to your Tauri backend
            const savedModels = await invoke<Model[]>("get_saved_models");
            setModels(savedModels);
        } catch (error) {
            console.error("Error loading saved models:", error);
        }
    };

    const saveModel = async (model: Model) => {
        try {
            // Placeholder: Replace with actual call to your Tauri backend
            await invoke("save_model", { model });
            setModels((prevModels) => [...prevModels, model]);
        } catch (error) {
            console.error("Error saving model:", error);
        }
    };

    useEffect(() => {
        loadSavedModels();
    }, []);

    return (
        <ModelContext.Provider value={{ currentModel, setCurrentModel, models, loadSavedModels, saveModel }}>
            {children}
        </ModelContext.Provider>
    );
};

export const useModel = () => {
    const context = useContext(ModelContext);
    if (context === undefined) {
        throw new Error('useModel must be used within a ModelProvider');
    }
    return context;
};

export const useModel = () => {
    const context = useContext(ModelContext);
    if (context === undefined) {
        throw new Error('useModel must be used within a ModelProvider');
    }
    return context;
};