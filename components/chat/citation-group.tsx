"use client";

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
} from "@/components/ai-elements/inline-citation";
import { Badge } from "@/components/ui/badge";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import {
  type CitationSource,
  getCitationDisplayUrl,
  getCitationTriggerLabel,
  resolveCitationSources,
} from "@/lib/citations";

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

export function CitationGroup({
  ids,
  sources,
  segmentKey,
}: {
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
