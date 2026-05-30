import { createUIMessageStream, JsonToSseTransformStream } from "ai";
import { differenceInSeconds } from "date-fns";
import { auth } from "@/app/(auth)/auth";
import {
  getChatById,
  getMessagesByChatId,
  getStreamIdsByChatId,
} from "@/lib/db/queries";
import type { Chat } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages } from "@/lib/utils";
import { getStreamContext } from "../../route";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;

  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  if (!chatId) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  let chat: Chat;

  try {
    const selectedChat = await getChatById({ id: chatId });
    if (!selectedChat) {
      return new ChatbotError("not_found:chat").toResponse();
    }
    chat = selectedChat;
  } catch {
    return new ChatbotError("not_found:chat").toResponse();
  }

  if (chat.visibility === "private" && chat.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    return new ChatbotError("not_found:stream").toResponse();
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ChatbotError("not_found:stream").toResponse();
  }

  const emptyDataStream = createUIMessageStream<ChatMessage>({
    execute: () => {},
  });

  const stream = await streamContext.resumableStream(recentStreamId, () =>
    emptyDataStream.pipeThrough(new JsonToSseTransformStream())
  );

  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = convertToUIMessages(messages).at(-1);

    if (!mostRecentMessage) {
      return new Response(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== "assistant") {
      return new Response(emptyDataStream, { status: 200 });
    }

    const dbMessage = messages.at(-1);

    if (!dbMessage) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(dbMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const restoredStream = createUIMessageStream<ChatMessage>({
      execute: ({ writer }) => {
        writer.write({
          type: "data-appendMessage",
          data: JSON.stringify(mostRecentMessage),
          transient: true,
        });
      },
    });

    return new Response(
      restoredStream.pipeThrough(new JsonToSseTransformStream()),
      { status: 200 }
    );
  }

  return new Response(stream, { status: 200 });
}
