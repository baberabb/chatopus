import React from "react";
import { Card } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { useProviderSettings } from "../../hooks/useProviderSettings";
import { useCustomParameters } from "../../hooks/useCustomParameters";
import { ProviderCard } from "./ProviderCard";
import { CustomParameterForm } from "./CustomParameterForm";
import { providerConfigs } from "../../config/providers";
import { ProviderType, ProviderSettings } from "../../types";

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

  // Ensure we have a valid settings object
  const safeSettings = React.useMemo(() => {
    if (!settings) return {};
    return Object.keys(providerConfigs).reduce(
      (acc, provider) => {
        acc[provider] = settings[provider] || {
          api_key: "",
          model: providerConfigs[provider].models[0],
          parameters: {},
          customParameters: {},
        };
        return acc;
      },
      {} as Record<string, ProviderSettings>,
    );
  }, [settings]);

  const {
    showForm: showCustomParamForm,
    setShowForm: setShowCustomParamForm,
    addCustomParameter,
    removeCustomParameter,
  } = useCustomParameters(
    activeProvider as ProviderType,
    React.useCallback(
      (provider, newSettings) => {
        const providerSettings = safeSettings[provider];
        if (providerSettings) {
          const updatedSettings = {
            ...providerSettings,
            ...newSettings,
          };
          updateProviderSetting(
            provider,
            "customParameters",
            updatedSettings.customParameters,
          );
        }
      },
      [safeSettings, updateProviderSetting],
    ),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  const handleSaveSettings = async (provider: ProviderType) => {
    try {
      const providerSettings = safeSettings[provider];
      if (!providerSettings) {
        console.error("Provider settings not found");
        return;
      }
      // Update each setting individually
      await Promise.all([
        updateProviderSetting(provider, "api_key", providerSettings.api_key),
        updateProviderSetting(provider, "model", providerSettings.model),
        updateProviderSetting(
          provider,
          "parameters",
          providerSettings.parameters,
        ),
        updateProviderSetting(
          provider,
          "customParameters",
          providerSettings.customParameters,
        ),
      ]);
      await reloadConfig();
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const handleProviderChange = async (newProvider: ProviderType) => {
    try {
      // Switch to the new provider
      await setProvider(newProvider);
    } catch (error) {
      // Error will be handled by useProviderSettings hook
      console.error("Failed to switch provider:", error);
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
                onClick={() => handleProviderChange(provider as ProviderType)}
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
                  settings={safeSettings[provider]}
                  isActive={provider === activeProvider}
                  onSelect={() =>
                    handleProviderChange(provider as ProviderType)
                  }
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
