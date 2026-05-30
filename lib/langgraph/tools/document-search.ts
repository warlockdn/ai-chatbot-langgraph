import { z } from "zod";

export const documentSearchInputSchema = z.object({
  query: z.string().describe("Search query for indexed documents"),
  keywords: z
    .array(z.string())
    .describe("Keywords to search for in the documents"),
});

export const documentSearchResultSchema = z.object({
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  score: z.number().optional(),
});

export const documentSearchOutputSchema = z.object({
  results: z.array(documentSearchResultSchema),
});

export type DocumentSearchTool = {
  input: z.infer<typeof documentSearchInputSchema>;
  output: z.infer<typeof documentSearchOutputSchema>;
};
