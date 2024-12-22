import { ProviderConfig } from "../types";

export const providerConfigs: Record<string, ProviderConfig> = {
  anthropic: {
    name: "Anthropic",
    models: [
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
      "claude-2.1",
      "claude-2.0",
    ],
    parameters: {
      max_tokens: {
        type: "number",
        label: "Max Tokens",
        default: 1024,
        validation: {
          min: 1,
          max: 4096,
          step: 1,
        },
      },
      streaming: {
        type: "boolean",
        label: "Enable Streaming",
        default: true,
      },
      temperature: {
        type: "number",
        label: "Temperature",
        description: "Controls randomness in the output",
        default: 0.7,
        validation: {
          min: 0,
          max: 2,
          step: 0.1,
        },
      },
      top_p: {
        type: "number",
        label: "Top P",
        description: "Controls diversity of the output",
        default: 1,
        validation: {
          min: 0,
          max: 1,
          step: 0.1,
        },
      },
      top_k: {
        type: "number",
        label: "Top K",
        default: 5,
        validation: {
          min: 0,
          step: 1,
        },
      },
    },
  },
  openai: {
    name: "OpenAI",
    models: [
      "gpt-4-turbo-preview",
      "gpt-4-0125-preview",
      "gpt-4",
      "gpt-3.5-turbo",
    ],
    parameters: {
      max_tokens: {
        type: "number",
        label: "Max Tokens",
        default: 1024,
        validation: {
          min: 1,
          max: 4096,
          step: 1,
        },
      },
      streaming: {
        type: "boolean",
        label: "Enable Streaming",
        default: true,
      },
      temperature: {
        type: "number",
        label: "Temperature",
        description: "Controls randomness in the output",
        default: 0.7,
        validation: {
          min: 0,
          max: 2,
          step: 0.1,
        },
      },
      top_p: {
        type: "number",
        label: "Top P",
        description: "Controls diversity of the output",
        default: 1,
        validation: {
          min: 0,
          max: 1,
          step: 0.1,
        },
      },
      presence_penalty: {
        type: "number",
        label: "Presence Penalty",
        default: 0,
        validation: {
          min: -2,
          max: 2,
          step: 0.1,
        },
      },
      frequency_penalty: {
        type: "number",
        label: "Frequency Penalty",
        default: 0,
        validation: {
          min: -2,
          max: 2,
          step: 0.1,
        },
      },
      tool_calls: {
        type: "boolean",
        label: "Enable Tool Calls",
        default: false,
      },
      tool_choice: {
        type: "select",
        label: "Tool Choice",
        default: "none",
        validation: {
          options: ["none", "auto", "function"],
        },
      },
    },
  },
  openrouter: {
    name: "OpenRouter",
    models: [
      "anthropic/claude-3-opus",
      "anthropic/claude-3-sonnet",
      "openai/gpt-4-turbo-preview",
      "google/gemini-pro",
      "meta/llama-3-70b",
    ],
    parameters: {
      max_tokens: {
        type: "number",
        label: "Max Tokens",
        default: 1024,
        validation: {
          min: 1,
          max: 4096,
          step: 1,
        },
      },
      streaming: {
        type: "boolean",
        label: "Enable Streaming",
        default: true,
      },
      temperature: {
        type: "number",
        label: "Temperature",
        description: "Controls randomness in the output",
        default: 0.7,
        validation: {
          min: 0,
          max: 2,
          step: 0.1,
        },
      },
      top_p: {
        type: "number",
        label: "Top P",
        description: "Controls diversity of the output",
        default: 1,
        validation: {
          min: 0,
          max: 1,
          step: 0.1,
        },
      },
      top_k: {
        type: "number",
        label: "Top K",
        default: 5,
        validation: {
          min: 0,
          step: 1,
        },
      },
      presence_penalty: {
        type: "number",
        label: "Presence Penalty",
        default: 0,
        validation: {
          min: -2,
          max: 2,
          step: 0.1,
        },
      },
      frequency_penalty: {
        type: "number",
        label: "Frequency Penalty",
        default: 0,
        validation: {
          min: -2,
          max: 2,
          step: 0.1,
        },
      },
    },
  },
};
