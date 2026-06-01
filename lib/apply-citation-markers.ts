import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CitationGroup } from "@/components/chat/citation-group";
import type { CitationSource } from "@/lib/citations";
import { parseCitationMarkerGroup } from "@/lib/citations";

const CITATION_MARKER_IN_TEXT = /\[\d+\]/;
const CITATION_GROUP_PATTERN = /(?:\s*\[\d+\])+/g;

const SKIP_SELECTOR =
  "code, pre, script, style, [data-citation-root], [data-streamdown='code-block'], [data-streamdown='code-block-body']";

function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;

  if (!parent) {
    return true;
  }

  return Boolean(parent.closest(SKIP_SELECTOR));
}

function replaceCitationMarkersInTextNode(
  textNode: Text,
  sources: Record<string, CitationSource>,
  roots: Root[]
) {
  const content = textNode.textContent ?? "";

  if (!CITATION_MARKER_IN_TEXT.test(content)) {
    return;
  }

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let segmentIndex = 0;

  for (const match of content.matchAll(CITATION_GROUP_PATTERN)) {
    const start = match.index ?? 0;

    if (start > lastIndex) {
      fragment.appendChild(
        document.createTextNode(content.slice(lastIndex, start))
      );
    }

    const ids = parseCitationMarkerGroup(match[0]);

    if (ids.length > 0) {
      const mountPoint = document.createElement("span");
      mountPoint.className = "inline align-baseline";
      mountPoint.dataset.citationRoot = ids.join("-");
      fragment.appendChild(mountPoint);

      const root = createRoot(mountPoint);
      root.render(
        createElement(CitationGroup, {
          ids,
          segmentKey: `${segmentIndex}-${ids.join("-")}`,
          sources,
        })
      );
      roots.push(root);
      segmentIndex += 1;
    }

    lastIndex = start + match[0].length;
  }

  if (lastIndex < content.length) {
    fragment.appendChild(document.createTextNode(content.slice(lastIndex)));
  }

  textNode.replaceWith(fragment);
}

export function applyCitationMarkersToDom(
  container: HTMLElement,
  sources: Record<string, CitationSource>
): Root[] {
  const roots: Root[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

  const textNodes: Text[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text;

    if (shouldSkipTextNode(textNode)) {
      continue;
    }

    if (CITATION_MARKER_IN_TEXT.test(textNode.textContent ?? "")) {
      textNodes.push(textNode);
    }
  }

  for (const textNode of textNodes) {
    replaceCitationMarkersInTextNode(textNode, sources, roots);
  }

  return roots;
}

export function unmountCitationRoots(roots: Root[]) {
  for (const root of roots) {
    root.unmount();
  }
}
