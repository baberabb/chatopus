# Store Implementation

This document explains how configuration data is managed and persisted in the application.

## Related Documentation

- [Backend API Documentation](./API.md) - For details on the Tauri commands
- [Frontend Architecture](./ARCHITECTURE.md) - For the overall frontend design
- [Security Model](./SECURITY.md) - For details on secure storage practices

## Architecture Overview

The store implementation uses a two-layer approach:

1. Backend persistent storage using Tauri's store plugin
2. Frontend state management using Zustand

This design ensures reliable persistence while maintaining responsive UI updates.

## Backend Implementation

### Store Plugin Setup

```rust
// lib.rs
.plugin(tauri_plugin_store::Builder::default().build())
```

The Tauri store plugin:

- Automatically handles persistence in the system's app data directory
- Manages atomic file operations
- Handles serialization/deserialization

### Config Management

```rust
// config.rs
pub const STORE_PATH: &str = ".config/chatopus/config.json";

// Loading config
pub async fn get_config(app: tauri::AppHandle, config: State<'_, ConfigState>) -> Result<AppConfig, String> {
    let store = app.store(STORE_PATH)?;
    match store.get("config") {
        Some(stored_config) => // Parse and return stored config
        None => // Return default config
    }
}

// Updating config
pub async fn update_provider_settings(app: tauri::AppHandle, provider: String, settings: ProviderSettings) -> Result<(), String> {
    let store = app.store(STORE_PATH)?;
    // Update config
    store.set("config", json!(config))?;
    store.save()?;
}
```

The backend:

- Stores config in the system's app data directory
- Provides atomic read/write operations
- Handles defaults and migrations
- Validates config updates

## Frontend Implementation

### Store Definition

```typescript
// store.ts
export const useModelStore = create<ModelStore>((set, get) => ({
  config: null,
  initialized: false,

  // Update methods
  updateProviderSettings: async (provider, settings) => {
    // Send to backend
    await invoke("update_provider_settings", { provider, settings });
    // Update local state after confirmation
    set((state) => ({
      config: {
        active_provider: currentConfig.active_provider,
        providers: {
          ...currentConfig.providers,
          [provider]: settings,
        },
      },
    }));
  },
}));
```

The frontend store:

- Maintains local state for UI responsiveness
- Delegates all persistence to backend
- Updates local state only after backend confirmation
- Provides type-safe access to config

### Initialization Flow

1. Backend starts up:

   - Initializes store plugin
   - Loads stored config or creates defaults
   - Sets up config state

2. Frontend initializes:

   ```typescript
   // Initial load
   const config = await invoke<ModelConfig>("get_config");
   useModelStore.setState({ config, initialized: true });
   ```

3. During runtime:
   - All updates go through backend first
   - Local state updated only after successful persistence
   - Errors properly handled and displayed to user

## Theme vs Config Storage

The application makes a deliberate distinction between theme preferences and configuration storage:

### Theme Storage (Frontend)

```typescript
// Uses localStorage for UI preferences only
localStorage.setItem(THEME_STORAGE_KEY, newThemeType);
```

Theme preferences are stored in localStorage because:

- They are UI-only preferences
- Don't contain sensitive information
- Need to be immediately available for UI rendering
- Don't need backend synchronization

### Config Storage (Backend)

```typescript
// All config changes go through backend
await invoke("update_provider_settings", { provider, settings });
```

Configuration data (including API keys) uses backend storage because:

- Contains sensitive information
- Needs to be securely persisted
- Requires validation and synchronization
- Benefits from atomic updates

## API Key Handling

API keys are:

1. Stored securely in the system's app data directory
2. Never cached in localStorage
3. Loaded only during initialization
4. Updated through backend commands
5. Persisted automatically by the store plugin

## File Locations

- macOS: `~/Library/Application Support/[app]/.config/chatopus/config.json`
- Linux: `~/.config/[app]/.config/chatopus/config.json`
- Windows: `%APPDATA%/[app]/.config/chatopus/config.json`

## Best Practices

When working with the store:

1. Always use backend commands for updates:

   ```typescript
   // Do this
   await useModelStore.getState().updateProviderSettings(provider, settings);

   // Don't do this
   localStorage.setItem("config", JSON.stringify(settings));
   ```

2. Handle loading states:

   ```typescript
   const { config, initialized } = useModelStore();
   if (!initialized) {
     return <LoadingSpinner />;
   }
   ```

3. Proper error handling:

   ```typescript
   try {
     await updateProviderSettings(provider, settings);
   } catch (error) {
     // Handle error appropriately
   }
   ```

4. Type safety:
   ```typescript
   interface ProviderSettings {
     api_key: string;
     model: string;
     parameters: Record<string, unknown>;
   }
   ```

## Debugging

To debug store issues:

1. Check the store file:

   ```bash
   cat ~/Library/Application Support/[app]/.config/chatopus/config.json
   ```

2. Monitor store operations in the console:

   ```typescript
   logger.state("Store", {
     action: "updateSettings",
     provider,
     result: "success",
   });
   ```

3. Verify store initialization:
   ```typescript
   if (!useModelStore.getState().initialized) {
     console.warn("Store not initialized");
   }
   ```

## Troubleshooting

### API Key Persistence Issues

If API keys are not persisting between app resets:

1. Verify store file exists and is writable:

   ```bash
   ls -l ~/Library/Application Support/[app]/.config/chatopus/config.json
   ```

2. Check store file contents:

   ```bash
   cat ~/Library/Application Support/[app]/.config/chatopus/config.json | grep -v api_key
   ```

   Note: The grep -v excludes API keys from output for security

3. Common causes:

   - Store file permissions incorrect
   - Store initialization failed
   - Frontend using localStorage instead of backend commands
   - Config updates not being saved properly

4. Solutions:
   - Ensure all config updates use backend commands
   - Verify store.save() is called after updates
   - Check app data directory permissions
   - Monitor backend logs for store errors

### Store Initialization Issues

If the store isn't initializing properly:

1. Check initialization order:

   - Backend store plugin must initialize first
   - Config must be loaded before provider setup
   - Frontend must wait for initialization

2. Verify store state:

   ```typescript
   const { initialized, config } = useModelStore.getState();
   console.log("Store state:", { initialized, hasConfig: !!config });
   ```

3. Common causes:

   - Race conditions in initialization
   - Missing error handling
   - Store plugin not configured properly

4. Solutions:
   - Add proper loading states
   - Improve error handling
   - Verify plugin configuration
   - Add initialization logging
