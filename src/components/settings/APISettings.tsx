import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import { Button } from "../ui/button";
import { useProviderSettings } from "../../hooks/useProviderSettings";
import { ProviderType } from "../../types";

export function APISettings() {
  const {
    loading,
    error,
    settings,
    activeProvider,
    updateProviderSetting,
    setProvider,
  } = useProviderSettings();

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
        Error: {error || "API configuration not found"}
      </div>
    );
  }

  return (
    <Card className="w-[800px]">
      <CardHeader>
        <CardTitle>API Settings</CardTitle>
        <CardDescription>Configure your API providers</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.keys(settings).map((provider) => (
              <Button
                key={provider}
                variant={provider === activeProvider ? "default" : "outline"}
                onClick={() => setProvider(provider as ProviderType)}
                className="flex items-center"
              >
                {provider}
              </Button>
            ))}
          </div>
        </div>

        {activeProvider && settings[activeProvider] && (
          <div className="mt-6">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Active Provider</h3>
                      <p className="text-sm text-gray-500">
                        Currently using {activeProvider}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => (window.location.href = "/settings/model")}
                    >
                      Configure Provider
                    </Button>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Selected Model</h3>
                    <p className="text-sm">{settings[activeProvider].model}</p>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">API Status</h3>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm">Connected</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
