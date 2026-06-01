"use client";

import { useLayoutEffect, useRef } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  applyCitationMarkersToDom,
  unmountCitationRoots,
} from "@/lib/apply-citation-markers";
import { type CitationSource, messageHasCitationMarkers } from "@/lib/citations";
import { sanitizeText } from "@/lib/utils";
import type { Root } from "react-dom/client";

type MessageWithCitationsProps = {
  text: string;
  sources: Record<string, CitationSource>;
  className?: string;
  isStreamComplete: boolean;
};

export function MessageWithCitations({
  text,
  sources,
  className,
  isStreamComplete,
}: MessageWithCitationsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const citationRootsRef = useRef<Root[]>([]);
  const processedTextRef = useRef<string | null>(null);
  const frozenTextRef = useRef<string | null>(null);

  const sanitizedText = sanitizeText(text);
  const hasMarkers = messageHasCitationMarkers(sanitizedText);
  const hasSources = Object.keys(sources).length > 0;

  if (!isStreamComplete) {
    frozenTextRef.current = null;
    processedTextRef.current = null;
  } else if (frozenTextRef.current === null) {
    frozenTextRef.current = sanitizedText;
  }

  const displayText = isStreamComplete
    ? (frozenTextRef.current ?? sanitizedText)
    : sanitizedText;

  useLayoutEffect(() => {
    if (!isStreamComplete || !hasMarkers || !hasSources) {
      return;
    }

    const container = containerRef.current;

    if (!container || processedTextRef.current === displayText) {
      return;
    }

    unmountCitationRoots(citationRootsRef.current);
    citationRootsRef.current = applyCitationMarkersToDom(container, sources);
    processedTextRef.current = displayText;
  }, [displayText, hasMarkers, hasSources, isStreamComplete, sources]);

  useLayoutEffect(
    () => () => {
      unmountCitationRoots(citationRootsRef.current);
      citationRootsRef.current = [];
      processedTextRef.current = null;
    },
    []
  );

  return (
    <div ref={containerRef}>
      <MessageResponse
        animated={hasMarkers ? false : undefined}
        className={className}
      >
        {displayText}
      </MessageResponse>
    </div>
  );
}
