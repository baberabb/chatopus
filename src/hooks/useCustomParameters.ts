import { useState } from "react";
import {
  CustomParameterFormData,
  ProviderType,
  ProviderSettings,
} from "../types";
import { providerConfigs } from "../config/providers";

export function useCustomParameters(
  provider: ProviderType,
  onSettingsUpdate: (
    provider: ProviderType,
    settings: Partial<ProviderSettings>,
  ) => void,
) {
  const [showForm, setShowForm] = useState(false);

  const addCustomParameter = (parameter: CustomParameterFormData) => {
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

    // Update settings with default value
    onSettingsUpdate(provider, {
      customParameters: {
        [parameter.name]: parameter.default,
      },
    });

    setShowForm(false);
  };

  const removeCustomParameter = (paramName: string) => {
    const providerConfig = providerConfigs[provider];

    if (providerConfig.customParameters) {
      delete providerConfig.customParameters[paramName];
    }

    onSettingsUpdate(provider, {
      customParameters: {
        [paramName]: undefined,
      },
    });
  };

  return {
    showForm,
    setShowForm,
    addCustomParameter,
    removeCustomParameter,
  };
}
