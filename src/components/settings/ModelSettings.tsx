import React from "react";
import { Card } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { useProviderSettings } from "../../hooks/useProviderSettings";
import { useCustomParameters } from "../../hooks/useCustomParameters";
import { ProviderCard } from "./ProviderCard";
import { CustomParameterForm } from "./CustomParameterForm";
import { providerConfigs } from "../../config/providers";
import { ProviderType } from "../../types";

export function ModelSettings() {
  const {
    loading,
    error,
    settings,
    activeProvider,
    updateProviderSetting,
    setProvider,
    reloadConfig,
  } = useProviderSettings();

  const {
    showForm: showCustomParamForm,
    setShowForm: setShowCustomParamForm,
    addCustomParameter,
    removeCustomParameter,
  } = useCustomParameters(
    activeProvider as ProviderType,
    (provider, newSettings) => {
      if (settings[provider]) {
        const updatedSettings = {
          ...settings[provider],
          ...newSettings,
        };
        updateProviderSetting(
          provider,
          "customParameters",
          updatedSettings.customParameters
        );
      }
    }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500" />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="p-6 text-red-500">
        Error: {error || "Model configuration not found"}
      </div>
    );
  }

  const handleSaveSettings = async (provider: ProviderType) => {
    try {
      const providerSettings = settings[provider];
      // Update each setting individually
      await Promise.all([
        updateProviderSetting(provider, "api_key", providerSettings.api_key),
        updateProviderSetting(provider, "model", providerSettings.model),
        updateProviderSetting(
          provider,
          "parameters",
          providerSettings.parameters
        ),
        updateProviderSetting(
          provider,
          "customParameters",
          providerSettings.customParameters
        ),
      ]);
      await reloadConfig();
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Model Settings</h2>

        <Tabs defaultValue={activeProvider} className="w-full">
          <TabsList className="w-full justify-start">
            {Object.entries(providerConfigs).map(([provider, config]) => (
              <TabsTrigger
                key={provider}
                value={provider}
                onClick={() => setProvider(provider as ProviderType)}
                className="flex-1"
              >
                {config.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.keys(providerConfigs).map((provider) => (
            <TabsContent key={provider} value={provider} className="mt-6">
              <div className="space-y-6">
                <ProviderCard
                  provider={provider as ProviderType}
                  settings={settings[provider]}
                  isActive={provider === activeProvider}
                  onSelect={() => setProvider(provider as ProviderType)}
                  onSettingChange={(key, value) =>
                    updateProviderSetting(provider as ProviderType, key, value)
                  }
                  onSave={() => handleSaveSettings(provider as ProviderType)}
                />

                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Custom Parameters</h3>
                  <Button
                    variant="outline"
                    onClick={() => setShowCustomParamForm(true)}
                  >
                    Add Parameter
                  </Button>
                </div>

                {showCustomParamForm && (
                  <CustomParameterForm
                    onAdd={(parameter) => addCustomParameter(parameter)}
                    onCancel={() => setShowCustomParamForm(false)}
                  />
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Card>
  );
}
