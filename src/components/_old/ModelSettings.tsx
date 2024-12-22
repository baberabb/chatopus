import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useModelStore } from "../store";
import {
  ProviderType,
  ParameterConfig,
  CustomParameterFormData,
} from "../types";
import { providerConfigs } from "../config/providers";
import { CustomParameterForm } from "./CustomParameterForm";

export function ModelSettings() {
  const { config, updateProviderSettings, setActiveProvider, initialized } =
    useModelStore();
  const [showCustomParamForm, setShowCustomParamForm] = useState(false);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
      </div>
    );
  }

  if (!config || !config.providers) {
    return (
      <div className="p-6 text-red-500">
        Error: Model configuration not found
      </div>
    );
  }

  const handleProviderChange = async (provider: ProviderType) => {
    try {
      await invoke("set_active_provider", { provider });
      setActiveProvider(provider);
    } catch (error) {
      console.error("Failed to update active provider:", error);
    }
  };

  const handleSettingChange = (
    provider: ProviderType,
    setting: string,
    value: string | number | boolean,
    isCustom = false
  ) => {
    const currentSettings = config.providers[provider];
    const newSettings = {
      ...currentSettings,
      parameters: isCustom
        ? currentSettings.parameters
        : { ...currentSettings.parameters, [setting]: value },
      customParameters: isCustom
        ? { ...(currentSettings.customParameters || {}), [setting]: value }
        : currentSettings.customParameters,
    };
    updateProviderSettings(provider, newSettings);
  };

  const handleAddCustomParameter = (
    provider: ProviderType,
    parameter: CustomParameterFormData
  ) => {
    const currentSettings = config.providers[provider];
    const providerConfig = providerConfigs[provider];

    // Add to provider config
    providerConfig.customParameters = {
      ...(providerConfig.customParameters || {}),
      [parameter.name]: {
        type: parameter.type,
        label: parameter.label,
        description: parameter.description,
        default: parameter.default,
        validation: parameter.validation,
      },
    };

    // Add to settings with default value
    const newSettings = {
      ...currentSettings,
      customParameters: {
        ...(currentSettings.customParameters || {}),
        [parameter.name]: parameter.default,
      },
    };

    updateProviderSettings(provider, newSettings);
    setShowCustomParamForm(false);
  };

  const handleRemoveCustomParameter = (
    provider: ProviderType,
    paramName: string
  ) => {
    const currentSettings = config.providers[provider];
    const providerConfig = providerConfigs[provider];

    // Remove from provider config
    if (providerConfig.customParameters) {
      delete providerConfig.customParameters[paramName];
    }

    // Remove from settings
    if (currentSettings.customParameters) {
      const { [paramName]: _, ...rest } = currentSettings.customParameters;
      const newSettings = {
        ...currentSettings,
        customParameters: rest,
      };
      updateProviderSettings(provider, newSettings);
    }
  };

  const handleSaveSettings = async (provider: ProviderType) => {
    try {
      const settings = config.providers[provider];
      await invoke("update_provider_settings", { provider, settings });
    } catch (error) {
      console.error("Failed to save provider settings:", error);
    }
  };

  const renderParameter = (
    provider: ProviderType,
    paramKey: string,
    paramConfig: ParameterConfig,
    value: any,
    isCustom = false
  ) => {
    const paramContent = (
      <div className="space-y-2" key={paramKey}>
        <div className="flex justify-between items-center">
          <Label>{paramConfig.label}</Label>
          {isCustom && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveCustomParameter(provider, paramKey)}
            >
              Remove
            </Button>
          )}
        </div>
        {paramConfig.description && (
          <p className="text-sm text-gray-500">{paramConfig.description}</p>
        )}
        {paramConfig.type === "number" ? (
          <Input
            type="number"
            min={paramConfig.validation?.min}
            max={paramConfig.validation?.max}
            step={paramConfig.validation?.step}
            value={value}
            onChange={(e) =>
              handleSettingChange(
                provider,
                paramKey,
                parseFloat(e.target.value),
                isCustom
              )
            }
          />
        ) : paramConfig.type === "boolean" ? (
          <Switch
            checked={value}
            onCheckedChange={(checked) =>
              handleSettingChange(provider, paramKey, checked, isCustom)
            }
          />
        ) : paramConfig.type === "select" ? (
          <Select
            value={value}
            onValueChange={(value) =>
              handleSettingChange(provider, paramKey, value, isCustom)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paramConfig.validation?.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={value}
            onChange={(e) =>
              handleSettingChange(provider, paramKey, e.target.value, isCustom)
            }
          />
        )}
      </div>
    );

    return isCustom ? (
      <div key={paramKey} className="border p-4 rounded-lg">
        {paramContent}
      </div>
    ) : (
      paramContent
    );
  };

  const renderProviderSettings = (provider: ProviderType) => {
    const settings = config.providers[provider];
    const providerConfig = providerConfigs[provider];

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={settings.api_key}
              onChange={(e) => {
                const newSettings = {
                  ...settings,
                  api_key: e.target.value,
                  parameters: settings.parameters || {},
                  customParameters: settings.customParameters || {},
                };
                updateProviderSettings(provider, newSettings);
              }}
              placeholder={`Enter your ${providerConfig.name} API key`}
            />
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={settings.model}
              onValueChange={(value) => {
                const newSettings = {
                  ...settings,
                  model: value,
                  parameters: settings.parameters || {},
                  customParameters: settings.customParameters || {},
                };
                updateProviderSettings(provider, newSettings);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {providerConfig.models.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Default Parameters</h3>
            {Object.entries(providerConfig.parameters).map(([key, param]) =>
              renderParameter(
                provider,
                key,
                param,
                settings.parameters[key],
                false
              )
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Custom Parameters</h3>
              <Button
                variant="outline"
                onClick={() => setShowCustomParamForm(true)}
              >
                Add Parameter
              </Button>
            </div>
            {providerConfig.customParameters &&
              Object.entries(providerConfig.customParameters).map(
                ([key, param]) =>
                  renderParameter(
                    provider,
                    key,
                    param,
                    settings.customParameters?.[key],
                    true
                  )
              )}
          </div>

          {showCustomParamForm && (
            <div className="mt-4">
              <CustomParameterForm
                onAdd={(parameter) =>
                  handleAddCustomParameter(provider, parameter)
                }
                onCancel={() => setShowCustomParamForm(false)}
              />
            </div>
          )}

          <Button
            onClick={() => handleSaveSettings(provider)}
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
              {renderProviderSettings(provider as ProviderType)}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Card>
  );
}
