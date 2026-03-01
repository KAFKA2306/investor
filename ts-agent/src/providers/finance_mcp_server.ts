#!/usr/bin/env node
/**
 * Finance Alpha Intelligence MCP Server
 *
 * This server provides tools to interact with Japanese financial data (EDINET),
 * perform itemization, and calculate sentiment/alpha signals.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EdinetItemizer } from "./edinet_itemizer.ts";
import { EdinetProvider } from "./edinet_provider.ts";
import { EdinetSearchProvider } from "./edinet_search_provider.ts";

// Constants
const SERVER_NAME = "finance-alpha-intelligence";
const SERVER_VERSION = "1.0.0";

// Create MCP server instance
const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

// Providers
const searchProvider = new EdinetSearchProvider();
const itemizer = new EdinetItemizer();
const edinetProvider = new EdinetProvider();

// ─── Tool: Search EDINET ──────────────────────────────────────────────────

server.registerTool(
  "search_edinet",
  {
    title: "Search EDINET Documents",
    description:
      "Search Japanese EDINET documents (Annual Reports, etc.) using BM25 across various companies.",
    inputSchema: z
      .object({
        query: z
          .string()
          .describe("Search keywords (e.g., 'AI', '半導体', '成長戦略')"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Maximum results to return"),
      })
      .strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ query, limit }) => {
    try {
      const results = searchProvider.search(query, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        structuredContent: { results },
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

// ─── Tool: Get Document Section ───────────────────────────────────────────

server.registerTool(
  "get_document_section",
  {
    title: "Get EDINET Document Section",
    description:
      "Extract a specific section (e.g., Risk Factors, MD&A) from an EDINET document.",
    inputSchema: z
      .object({
        docID: z.string().describe("EDINET Document ID"),
        sectionPattern: z
          .string()
          .describe(
            "Section title to look for (e.g., '事業等のリスク', '経営者による財政状態')",
          ),
      })
      .strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ docID, sectionPattern }) => {
    try {
      // First ensure we have the document content (from index or provider)
      // For now, assume it's indexed or available via edinetProvider (simplified here)
      const zipPath = await edinetProvider.downloadDocument(docID, 1);
      if (!zipPath)
        throw new Error(`Document ${docID} not found or download failed.`);

      // (Simplified extraction logic similar to search_provider's indexer)
      const { execSync } = require("node:child_process");
      const stdout = execSync(`unzip -p "${zipPath}" "XBRL/PublicDoc/*.htm"`, {
        maxBuffer: 50 * 1024 * 1024,
      }).toString();

      const cleanText = stdout
        .replace(/<[^>]*>?/gm, " ")
        .replace(/\s+/g, " ")
        .trim();
      const section = itemizer.extractSection(cleanText, sectionPattern);

      if (!section) {
        return {
          content: [
            {
              type: "text",
              text: `Section matching "${sectionPattern}" not found in document ${docID}.`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: section }],
        structuredContent: { docID, sectionPattern, content: section },
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

// ─── Main ────────────────────────────────────────────────────────────────

async function runStdio() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Finance Alpha Intelligence MCP server running via stdio");
}

runStdio().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
