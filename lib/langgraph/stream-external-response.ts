import type { UIMessageStreamWriter } from "ai";
import type { ChatMessage } from "@/lib/types";

type ChatUIMessageChunk = Parameters<
  UIMessageStreamWriter<ChatMessage>["write"]
>[0];

function sanitizeStreamChunk(
  chunk: ChatUIMessageChunk,
  userMessageIds: ReadonlySet<string>
): ChatUIMessageChunk {
  if (
    chunk.type === "start" &&
    chunk.messageId != null &&
    userMessageIds.has(chunk.messageId)
  ) {
    return { type: "start", messageMetadata: chunk.messageMetadata };
  }

  return chunk;
}

function parseSseChunk(line: string): ChatUIMessageChunk | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) {
    return null;
  }

  const payload = trimmed.slice("data:".length).trim();
  if (!payload || payload === "[DONE]") {
    return null;
  }

  try {
    const chunk = JSON.parse(payload) as ChatUIMessageChunk;
    if (typeof chunk.type === "string") {
      return chunk;
    }
  } catch {
    return null;
  }

  return null;
}

async function pipeUiMessageStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  dataStream: UIMessageStreamWriter<ChatMessage>,
  userMessageIds: ReadonlySet<string>
) {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const chunk = parseSseChunk(line);
      if (chunk) {
        dataStream.write(sanitizeStreamChunk(chunk, userMessageIds));
      }
    }
  }

  const trailing = parseSseChunk(buffer);
  if (trailing) {
    dataStream.write(sanitizeStreamChunk(trailing, userMessageIds));
  }
}

export async function streamLanggraphResponse({
  response,
  dataStream,
  userMessageIds = new Set<string>(),
}: {
  response: Response;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  userMessageIds?: ReadonlySet<string>;
}) {
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      errorBody || `LangGraph API responded with status ${response.status}`
    );
  }

  if (!response.body) {
    throw new Error("LangGraph API returned an empty response body");
  }

  await pipeUiMessageStream(
    response.body.getReader(),
    dataStream,
    userMessageIds
  );
}
