"use client";

import { type ComponentProps, useMemo } from "react";
import { defaultUrlTransform } from "streamdown";
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationSource,
  InlineCitationText,
} from "@/components/ai-elements/inline-citation";
import { MessageResponse } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import {
  type CitationSource,
  embedCitationLinks,
  getCitationDisplayUrl,
  getCitationTriggerLabel,
  messageHasCitationMarkers,
  parseCitationHref,
  resolveCitationSources,
} from "@/lib/citations";
import { sanitizeText } from "@/lib/utils";

type MessageWithCitationsProps = {
  text: string;
  sources: Record<string, CitationSource>;
  className?: string;
};

const CITATION_LINK_PREFIX = "#citation-";

function CitationCardTrigger({ sources }: { sources: CitationSource[] }) {
  const urls = sources
    .map((source) => getCitationDisplayUrl(source.url))
    .filter((url): url is string => Boolean(url));

  if (urls.length > 0) {
    return <InlineCitationCardTrigger sources={urls} />;
  }

  return (
    <HoverCardTrigger asChild>
      <Badge
        className="ml-1 inline-flex max-w-[11rem] shrink-0 align-baseline rounded-full font-normal"
        variant="secondary"
      >
        <span className="truncate">{getCitationTriggerLabel(sources)}</span>
      </Badge>
    </HoverCardTrigger>
  );
}

function CitationGroup({
  citedText,
  ids,
  sources,
  segmentKey,
}: {
  citedText?: string;
  ids: string[];
  sources: Record<string, CitationSource>;
  segmentKey: string;
}) {
  const resolvedSources = resolveCitationSources(sources, ids);

  if (resolvedSources.length === 0) {
    return (
      <span
        className="mx-0.5 inline align-baseline rounded bg-muted px-1 font-medium text-muted-foreground text-xs"
        key={segmentKey}
      >
        {ids.map((id) => `[${id}]`).join("")}
      </span>
    );
  }

  return (
    <InlineCitation className="inline align-baseline" key={segmentKey}>
      {citedText ? <InlineCitationText>{citedText}</InlineCitationText> : null}
      <InlineCitationCard>
        <CitationCardTrigger sources={resolvedSources} />
        <InlineCitationCardBody>
          <InlineCitationCarousel>
            <InlineCitationCarouselHeader>
              <InlineCitationCarouselPrev />
              <InlineCitationCarouselNext />
              <InlineCitationCarouselIndex />
            </InlineCitationCarouselHeader>
            <InlineCitationCarouselContent>
              {resolvedSources.map((source) => (
                <InlineCitationCarouselItem key={source.url ?? source.id}>
                  <InlineCitationSource
                    description={source.description}
                    title={source.title ?? `Source ${source.id}`}
                    url={getCitationDisplayUrl(source.url)}
                  />
                </InlineCitationCarouselItem>
              ))}
            </InlineCitationCarouselContent>
          </InlineCitationCarousel>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  );
}

export function MessageWithCitations({
  text,
  sources,
  className,
}: MessageWithCitationsProps) {
  const sanitizedText = sanitizeText(text);
  const hasMarkers = messageHasCitationMarkers(sanitizedText);

  const markdownWithCitationLinks = useMemo(
    () => (hasMarkers ? embedCitationLinks(sanitizedText) : sanitizedText),
    [hasMarkers, sanitizedText]
  );

  const components = useMemo(
    () => ({
      a: ({
        href,
        children,
        ...props
      }: ComponentProps<"a"> & { href?: string }) => {
        if (typeof href === "string" && href.startsWith(CITATION_LINK_PREFIX)) {
          const parsed = parseCitationHref(href);

          if (!parsed) {
            return null;
          }

          return (
            <CitationGroup
              citedText={parsed.citedText}
              ids={parsed.ids}
              segmentKey={href}
              sources={sources}
            />
          );
        }

        return (
          <a href={href} rel="noopener noreferrer" target="_blank" {...props}>
            {children}
          </a>
        );
      },
    }),
    [sources]
  );

  if (!hasMarkers) {
    return (
      <MessageResponse className={className}>{sanitizedText}</MessageResponse>
    );
  }

  return (
    <MessageResponse
      className={className}
      components={components}
      urlTransform={(url, key, node) => {
        if (url.startsWith(CITATION_LINK_PREFIX)) {
          return url;
        }

        return defaultUrlTransform(url, key, node);
      }}
    >
      {markdownWithCitationLinks}
    </MessageResponse>
  );
}
