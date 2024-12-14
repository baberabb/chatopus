import React from "react";
import { Check, ChevronsUpDown, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Badge } from "./ui/badge";
import { useModel, type Model } from "../contexts/ModelContext";
import { ScrollArea } from "./ui/scroll-area";

export function ModelSelector() {
  const {
    selectedModels,
    availableModels,
    saveSelectedModels,
    loadAvailableModels,
    loading,
    error,
  } = useModel();
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const toggleModel = React.useCallback(
    (model: Model) => {
      const isSelected = selectedModels.some((m) => m.id === model.id);
      let newSelectedModels;

      if (isSelected) {
        // Don't allow deselecting if it's the last model
        if (selectedModels.length === 1) return;
        newSelectedModels = selectedModels.filter((m) => m.id !== model.id);
      } else {
        newSelectedModels = [...selectedModels, model];
      }

      saveSelectedModels(newSelectedModels);
    },
    [selectedModels, saveSelectedModels]
  );

  // Filter and group models by provider
  const modelsByProvider = React.useMemo(() => {
    if (!availableModels || availableModels.length === 0) {
      return [];
    }

    const filtered = availableModels.filter((model) => {
      const search = searchTerm.toLowerCase();
      return (
        model.name.toLowerCase().includes(search) ||
        model.provider.toLowerCase().includes(search)
      );
    });

    const grouped = new Map<string, Model[]>();
    filtered.forEach((model) => {
      const models = grouped.get(model.provider) || [];
      models.push(model);
      grouped.set(model.provider, models);
    });

    // Sort providers and models within each provider
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([provider, models]) => ({
        provider,
        models: models.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [availableModels, searchTerm]);

  const handleRetry = React.useCallback(() => {
    setOpen(false);
    loadAvailableModels();
  }, [loadAvailableModels]);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled className="min-w-[200px]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading models...
        </Button>
      </div>
    );
  }

  if (error || !availableModels || availableModels.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="text-red-500 hover:text-red-600 min-w-[200px]"
          onClick={handleRetry}
        >
          <AlertCircle className="mr-2 h-4 w-4" />
          {error || "No models available"} - Click to retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="min-w-[200px] justify-between"
          >
            <span className="truncate">
              {selectedModels.length > 0
                ? `${selectedModels.length} model${selectedModels.length > 1 ? "s" : ""} selected`
                : "Select models..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[300px] p-0"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search models..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              {modelsByProvider.length === 0 ? (
                <CommandEmpty>No models found.</CommandEmpty>
              ) : (
                <ScrollArea className="h-[300px]">
                  {modelsByProvider.map(({ provider, models }) => (
                    <CommandGroup
                      key={provider}
                      heading={provider.toUpperCase()}
                    >
                      {models.map((model) => (
                        <CommandItem
                          key={model.id}
                          value={`${model.provider}/${model.id}`}
                          onSelect={() => {
                            toggleModel(model);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedModels.some((m) => m.id === model.id)
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{model.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {model.provider}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </ScrollArea>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex gap-1 overflow-x-auto">
        {selectedModels.map((model) => (
          <Badge key={model.id} variant="secondary" className="text-xs">
            {model.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
