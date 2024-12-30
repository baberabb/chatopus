# Backend API Documentation

This document details the Tauri commands available in the application.

## Initialization Requirements

Before using these commands, ensure:

1. Store Plugin Setup

   ```rust
   .plugin(tauri_plugin_store::Builder::default().build())
   ```

2. App Data Directory

   ```rust
   let data_dir = app.path().app_data_dir().expect("failed to get app data dir");
   ```

3. Store Initialization

   ```rust
   let store = app.store(config::STORE_PATH)?;
   ```

4. Frontend Store Ready
   ```typescript
   if (!useModelStore.getState().initialized) {
     // Wait for initialization
     return;
   }
   ```

## Store Commands

### get_config

Retrieves the current configuration from the store.

```typescript
interface ModelConfig {
  active_provider: ProviderType;
  providers: Record<ProviderType, ProviderSettings>;
}

try {
  const config = await invoke<ModelConfig>("get_config");
} catch (error) {
  // Handle errors:
  // - Store access failed
  // - Config parsing failed
  // - Store not initialized
}
```

### update_provider_settings

Updates settings for a specific provider.

```typescript
interface ProviderSettings {
  api_key: string;
  model: string;
  parameters: Record<string, unknown>;
  customParameters?: Record<string, unknown>;
}

try {
  await invoke("update_provider_settings", {
    provider: "anthropic",
    settings: {
      api_key: "...",
      model: "claude-3-opus",
      parameters: {
        temperature: 0.7,
        max_tokens: 1024,
      },
    },
  });
} catch (error) {
  // Handle errors:
  // - Invalid provider
  // - Invalid settings
  // - Store save failed
}
```

### set_active_provider

Sets the currently active provider.

```typescript
try {
  await invoke("set_active_provider", { provider: "anthropic" });
} catch (error) {
  // Handle errors:
  // - Provider not registered
  // - Provider not configured
  // - Store save failed
}
```

### Error Handling

All store commands may throw errors for:

1. Store access issues
2. Validation failures
3. Persistence problems

Always wrap store commands in try/catch blocks and handle errors appropriately:

```typescript
try {
  await invoke("update_provider_settings", { ... });
} catch (error) {
  if (error.message.includes("not initialized")) {
    // Handle initialization error
  } else if (error.message.includes("validation failed")) {
    // Handle validation error
  } else {
    // Handle other errors
  }
}
```

## Command Validation

Each command performs specific validations:

### get_config

- Verifies store is accessible
- Validates config structure if exists
- Ensures all required providers are present

### update_provider_settings

- Validates provider exists
- Checks required fields (api_key, model)
- Validates parameter types and values
- Ensures store is writable

### set_active_provider

- Verifies provider is registered
- Ensures provider is configured
- Validates store write permissions

## Response Types

Each command returns a specific type:

### get_config

```typescript
type Response = ModelConfig | Error;
```

Success returns the full config object. Errors include store access and parsing failures.

### update_provider_settings

```typescript
type Response = void | Error;
```

Success returns nothing. Errors include validation and persistence failures.

### set_active_provider

```typescript
type Response = void | Error;
```

Success returns nothing. Errors include provider validation and persistence failures.

## Response Handling

Handle responses appropriately:

```typescript
// For commands that return data
try {
  const config = await invoke<ModelConfig>("get_config");
  // Use config data
} catch (error) {
  // Handle error
}

// For commands that return void
try {
  await invoke("update_provider_settings", { ... });
  // Success - update UI or proceed
} catch (error) {
  // Handle error
}
```

## Frontend Integration Example

Here's how settings are saved from the frontend, for example when saving an API key in the models page:

1. Component Setup:

```typescript
// ModelSettings.tsx
const { updateProviderSetting } = useProviderSettings();

const handleSaveSettings = async (provider: ProviderType) => {
  try {
    await Promise.all([
      updateProviderSetting(provider, "api_key", providerSettings.api_key),
      updateProviderSetting(provider, "model", providerSettings.model),
      // ... other settings
    ]);
    await reloadConfig();
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
};
```

2. Hook Implementation:

```typescript
// useProviderSettings.ts
const updateProviderSetting = async (
  provider: ProviderType,
  key: keyof ProviderSettings,
  value: any,
) => {
  // Get current settings
  const currentSettings = settings[provider];
  if (!currentSettings) {
    throw new Error("Provider settings not found");
  }

  // Create new settings object
  const newSettings = {
    ...currentSettings,
    [key]: value,
  };

  // Update backend and local state
  await invoke("update_provider_settings", { provider, settings: newSettings });
  setSettings((prev) => ({
    ...prev,
    [provider]: newSettings,
  }));
};
```

3. Flow:
   - User inputs API key in UI
   - Component calls updateProviderSetting
   - Hook updates backend via Tauri command
   - Backend saves to persistent store
   - Hook updates local state
   - UI reflects the change

This ensures:

- Atomic updates of settings
- Proper error handling
- Consistent state between frontend and backend
- Immediate UI feedback
- Persistent storage

### State Synchronization

The settings update process maintains synchronization through:

1. Optimistic Updates:

   ```typescript
   // Update local state immediately for UI responsiveness
   setSettings((prev) => ({
     ...prev,
     [provider]: newSettings,
   }));
   ```

2. Backend Validation:

   ```typescript
   // Backend validates before saving
   if (!newSettings.model) {
     throw new Error("Model is required");
   }
   ```

3. Error Recovery:

   ```typescript
   try {
     await invoke("update_provider_settings", ...);
   } catch (error) {
     // Revert optimistic update on error
     await reloadConfig();
   }
   ```

4. Config Reloading:
   ```typescript
   // Reload after updates to ensure consistency
   await reloadConfig();
   ```

This pattern ensures:

- Responsive UI through optimistic updates
- Data integrity through backend validation
- Recovery from failures
- Eventual consistency between frontend and backend

## Store Implementation Details

For detailed information about the store implementation and configuration management, see [Store Documentation](./STORE.md).
