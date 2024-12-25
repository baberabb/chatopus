import React, { useState, useCallback } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  useZustandTheme,
  useChatStore,
  useSystemMessage,
  useChatLoading,
} from "../../store";
import type { ChatState, Theme, Conversation } from "../../types";

// Define stable selectors outside component
const selectInitialized = (state: ChatState) => state.initialized;
const selectCurrentConversationId = (state: ChatState) =>
  state.currentConversationId;
const selectUpdateConversation = (state: ChatState) => state.updateConversation;

interface SystemMessageEditorProps {
  disabled?: boolean;
}

const SystemMessageEditorContent = React.memo(
  ({
    theme,
    systemMessage,
    disabled,
    currentConversationId,
    updateConversation,
  }: {
    theme: Theme;
    systemMessage: string | null;
    disabled?: boolean;
    currentConversationId: number | null;
    updateConversation: (
      id: number,
      updates: Partial<Conversation>
    ) => Promise<void>;
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(systemMessage || "");

    const handleSave = useCallback(() => {
      if (currentConversationId) {
        updateConversation(currentConversationId, { systemMessage: editValue });
      }
      setIsEditing(false);
    }, [currentConversationId, editValue, updateConversation]);

    const handleCancel = useCallback(() => {
      setEditValue(systemMessage || "");
      setIsEditing(false);
    }, [systemMessage]);

    return (
      <div
        className="px-4 py-2"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <Popover open={isEditing} onOpenChange={setIsEditing}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={disabled}
            >
              {systemMessage ? "Edit System Message" : "Set System Message"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <Textarea
                placeholder="Enter a system message..."
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={editValue === systemMessage}
                >
                  Save
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {systemMessage && (
          <div
            className="mt-2 text-sm p-2 rounded"
            style={{
              backgroundColor: theme.surface,
              border: `1px solid ${theme.border}`,
              color: theme.textSecondary,
            }}
          >
            {systemMessage}
          </div>
        )}
      </div>
    );
  }
);

SystemMessageEditorContent.displayName = "SystemMessageEditorContent";

export function SystemMessageEditor({ disabled }: SystemMessageEditorProps) {
  const { theme } = useZustandTheme();
  const systemMessage = useSystemMessage();
  const initialized = useChatStore(selectInitialized);
  const currentConversationId = useChatStore(selectCurrentConversationId);
  const updateConversation = useChatStore(selectUpdateConversation);

  // Return null if store is not initialized
  if (!initialized) {
    return null;
  }

  return (
    <SystemMessageEditorContent
      theme={theme}
      systemMessage={systemMessage}
      disabled={disabled}
      currentConversationId={currentConversationId}
      updateConversation={updateConversation}
    />
  );
}
