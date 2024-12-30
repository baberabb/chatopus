import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ProviderType, ProviderSettings, ParameterConfig } from "../../types";
import { providerConfigs } from "../../config/providers";

interface ProviderCardProps {
  provider: ProviderType;
  settings: ProviderSettings;
  isActive: boolean;
  onSelect: () => void;
  onSettingChange: <K extends keyof ProviderSettings>(
    key: K,
    value: ProviderSettings[K],
  ) => void;
  onSave: () => void;
}

interface BaseParameterFieldProps {
  paramKey: string;
  isCustom?: boolean;
  onRemove?: () => void;
}

interface ParameterFieldProps extends BaseParameterFieldProps {
  config: ParameterConfig;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}

const ParameterField: React.FC<ParameterFieldProps> = ({
  paramKey,
  config,
  value,
  onChange,
  isCustom,
  onRemove,
}) => {
  const renderInput = () => {
    switch (config.type) {
      case "number":
        return (
          <Input
            type="number"
            min={config.validation?.min}
            max={config.validation?.max}
            step={config.validation?.step}
            value={value.toString()}
            onChange={(e) => onChange(parseFloat(e.target.value))}
          />
        );
      case "boolean":
        return <Switch checked={Boolean(value)} onCheckedChange={onChange} />;
      case "select":
        return (
          <Select value={value.toString()} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {config.validation?.options?.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return (
          <Input
            value={value.toString()}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  };

  return (
    <div className={`space-y-2 ${isCustom ? "border p-4 rounded-lg" : ""}`}>
      <div className="flex justify-between items-center">
        <Label>{config.label}</Label>
        {isCustom && onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      {config.description && (
        <p className="text-sm text-gray-500">{config.description}</p>
      )}
      {renderInput()}
    </div>
  );
};

export function ProviderCard({
  provider,
  settings,
  isActive,
  onSelect,
  onSettingChange,
  onSave,
}: ProviderCardProps) {
  const providerConfig = providerConfigs[provider];

  // Ensure we have valid settings object with defaults
  const safeSettings = {
    api_key: settings?.api_key ?? "",
    model: settings?.model ?? providerConfig.models[0],
    parameters: settings?.parameters ?? {},
    customParameters: settings?.customParameters ?? {},
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{providerConfig.name}</CardTitle>
        <CardDescription>Configure provider settings</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={safeSettings.api_key}
              onChange={(e) => onSettingChange("api_key", e.target.value)}
              placeholder={`Enter your ${providerConfig.name} API key`}
            />
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={safeSettings.model}
              onValueChange={(value) => onSettingChange("model", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {providerConfig.models.map((model: string) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Default Parameters</h3>
            {Object.entries(providerConfig.parameters).map(([key, param]) => (
              <ParameterField
                key={key}
                paramKey={key}
                config={param}
                value={safeSettings.parameters[key] ?? param.default}
                onChange={(value) =>
                  onSettingChange("parameters", {
                    ...safeSettings.parameters,
                    [key]: value,
                  })
                }
              />
            ))}
          </div>

          <Button onClick={onSave} className="w-full mt-4">
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
