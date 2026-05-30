import type { ChatMessage } from "@/lib/types";

export type CitationSource = {
  id: string;
  url?: string;
  title?: string;
  description?: string;
};

export const CITATION_PLACEHOLDER_URL = "#";

const CITATION_MARKER_PATTERN = /(\[\d+\])/g;

const METADATA_TITLE_KEYS = ["title", "document_title", "name"] as const;
const METADATA_URL_KEYS = ["url", "source", "link"] as const;
const METADATA_DESCRIPTION_KEYS = [
  "description",
  "snippet",
  "content",
  "quote",
] as const;

function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  keys: readonly string[]
): string | undefined {
  if (!metadata) {
    return undefined;
  }

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function getDescriptionFromProviderMetadata(
  providerMetadata: Record<string, Record<string, unknown>> | undefined
): string | undefined {
  if (!providerMetadata) {
    return undefined;
  }

  for (const provider of Object.values(providerMetadata)) {
    const description = getMetadataString(provider, METADATA_DESCRIPTION_KEYS);
    if (description) {
      return description;
    }
  }

  return undefined;
}

export function getCitationTriggerSources(url?: string): string[] {
  if (url && url !== CITATION_PLACEHOLDER_URL) {
    return [url];
  }

  return [CITATION_PLACEHOLDER_URL];
}

export function getCitationDisplayUrl(url?: string): string | undefined {
  if (!url || url === CITATION_PLACEHOLDER_URL) {
    return undefined;
  }

  return url;
}

export function truncateCitationLabel(text: string, maxLength = 18): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

export function getCitationTriggerLabel(sources: CitationSource[]): string {
  const primary = truncateCitationLabel(
    sources[0]?.title?.trim() || `Source ${sources[0]?.id ?? "1"}`
  );

  if (sources.length > 1) {
    return `${primary} +${sources.length - 1}`;
  }

  return primary;
}

function mergeCitationSource(
  sources: Record<string, CitationSource>,
  id: string,
  next: Partial<CitationSource>
) {
  const existing = sources[id];

  sources[id] = {
    id,
    url: existing?.url ?? next.url,
    title: existing?.title ?? next.title,
    description: existing?.description ?? next.description,
  };
}

export function getCitationSourcesFromMessage(
  message: ChatMessage
): Record<string, CitationSource> {
  const sources: Record<string, CitationSource> = {};

  for (const part of message.parts) {
    if (part.type === "source-url") {
      mergeCitationSource(sources, part.sourceId, {
        url: part.url,
        title: part.title,
        description: getDescriptionFromProviderMetadata(
          part.providerMetadata as Record<string, Record<string, unknown>>
        ),
      });
    }

    if (part.type === "source-document") {
      mergeCitationSource(sources, part.sourceId, {
        title: part.title ?? part.filename,
        description: getDescriptionFromProviderMetadata(
          part.providerMetadata as Record<string, Record<string, unknown>>
        ),
      });
    }

    if (
      part.type === "tool-document_search" &&
      part.state === "output-available" &&
      part.output?.results
    ) {
      for (const [index, result] of part.output.results.entries()) {
        const id = String(index + 1);
        const metadata = result.metadata;

        mergeCitationSource(sources, id, {
          title:
            getMetadataString(metadata, METADATA_TITLE_KEYS) ?? `Source ${id}`,
          url: getMetadataString(metadata, METADATA_URL_KEYS),
          description: result.content,
        });
      }
    }
  }

  return sources;
}

export function messageHasCitationMarkers(text: string): boolean {
  return /\[\d+\]/.test(text);
}

export type CitationSegment =
  | { type: "text"; value: string }
  | { type: "citations"; ids: string[] };

const CITATION_GROUP_PATTERN = /(?:\s*\[\d+\])+/g;

export function resolveCitationSource(
  sources: Record<string, CitationSource>,
  id: string
): CitationSource | undefined {
  const direct = sources[id] ?? sources[`src_${id}`];

  if (direct) {
    return direct;
  }

  const index = Number.parseInt(id, 10) - 1;

  if (!Number.isFinite(index) || index < 0) {
    return undefined;
  }

  const numericKeys = Object.keys(sources)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b));

  if (index < numericKeys.length) {
    const key = numericKeys[index];
    if (key) {
      return sources[key];
    }
  }

  const srcKeys = Object.keys(sources)
    .filter((key) => /^src_\d+$/.test(key))
    .sort((a, b) => {
      const aNum = Number(a.slice(4));
      const bNum = Number(b.slice(4));
      return aNum - bNum;
    });

  if (index < srcKeys.length) {
    const key = srcKeys[index];
    if (key) {
      return sources[key];
    }
  }

  return undefined;
}

export function resolveCitationSources(
  sources: Record<string, CitationSource>,
  ids: string[]
): CitationSource[] {
  const orderedSources = Object.values(sources);

  return ids
    .map(
      (id, index) =>
        resolveCitationSource(sources, id) ??
        orderedSources[index] ??
        orderedSources[Number.parseInt(id, 10) - 1]
    )
    .filter((source): source is CitationSource =>
      Boolean(source && (source.url || source.title || source.description))
    );
}

export function embedCitationLinks(text: string): string {
  const parts: string[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(CITATION_GROUP_PATTERN)) {
    const start = match.index ?? 0;
    const citedText = extractCitedText(text, start);
    const before = text.slice(0, start);
    const citedTextStart =
      citedText && before.endsWith(citedText)
        ? start - citedText.length
        : start;

    parts.push(text.slice(lastIndex, citedTextStart));

    const ids = [...match[0].matchAll(/\[(\d+)\]/g)].map((item) => item[1]);
    const textSuffix = citedText
      ? `~${encodeURIComponent(citedText)}`
      : "";

    parts.push(`[](#citation-${ids.join("-")}${textSuffix})`);
    lastIndex = start + match[0].length;
  }

  parts.push(text.slice(lastIndex));

  return parts.join("");
}

function extractCitedText(text: string, citationStart: number): string {
  const before = text.slice(0, citationStart).trimEnd();
  const match = before.match(/(?:^|[.!?]\s+|\n+)([^\n]*?)$/);

  return match?.[1]?.trim() ?? "";
}

export type ParsedCitationHref = {
  citedText?: string;
  ids: string[];
};

export function parseCitationHref(href: string): ParsedCitationHref | null {
  if (!href.startsWith("#citation-")) {
    return null;
  }

  const payload = href.slice("#citation-".length);
  const separatorIndex = payload.indexOf("~");
  const idPart =
    separatorIndex === -1 ? payload : payload.slice(0, separatorIndex);
  const citedTextEncoded =
    separatorIndex === -1 ? undefined : payload.slice(separatorIndex + 1);
  const ids = idPart.split("-").filter(Boolean);

  if (ids.length === 0) {
    return null;
  }

  let citedText: string | undefined;

  if (citedTextEncoded) {
    try {
      citedText = decodeURIComponent(citedTextEncoded);
    } catch {
      citedText = citedTextEncoded;
    }
  }

  return { ids, citedText };
}

export function splitTextWithCitationMarkers(text: string): string[] {
  return text.split(CITATION_MARKER_PATTERN);
}

export function parseCitationMarker(segment: string): string | null {
  const match = segment.match(/^\[(\d+)\]$/);
  return match?.[1] ?? null;
}
