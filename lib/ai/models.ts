export const DEFAULT_CHAT_MODEL = "gpt-5.4-mini";

export const titleModel = {
  id: "gpt-5.4-mini",
  name: "GPT-5.4 mini",
  provider: "openai",
  description: "Fast model for title generation",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

const capabilitiesByModelId: Record<string, ModelCapabilities> = {
  "gpt-5.4-mini": { tools: true, vision: true, reasoning: false },
};

export const chatModels: ChatModel[] = [
  {
    id: "gpt-5.4-mini",
    name: "GPT-5.4 mini",
    provider: "openai",
    description: "Fast and cost-effective",
  },
];

export function getCapabilities(): Record<string, ModelCapabilities> {
  return Object.fromEntries(
    chatModels.map((model) => [
      model.id,
      capabilitiesByModelId[model.id] ?? {
        tools: false,
        vision: false,
        reasoning: false,
      },
    ])
  );
}

export const isDemo = process.env.IS_DEMO === "1";

type OpenAIModel = {
  id: string;
  owned_by?: string;
};

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  const endpoint = process.env.OPENAI_ENDPOINT;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!endpoint || !apiKey) {
    return [];
  }

  try {
    const res = await fetch(`${endpoint}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      return [];
    }

    const json = await res.json();
    return (json.data ?? [])
      .filter(
        (m: OpenAIModel) => m.id.startsWith("gpt-") || m.id.startsWith("o")
      )
      .map((m: OpenAIModel) => ({
        id: m.id,
        name: m.id,
        provider: "openai",
        description: "",
        capabilities: capabilitiesByModelId[m.id] ?? {
          tools: true,
          vision: m.id.includes("5.4-mini"),
          reasoning: m.id.startsWith("o"),
        },
      }));
  } catch {
    return [];
  }
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
