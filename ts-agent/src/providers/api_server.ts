import { serve } from "bun";
import { MemoryCenter } from "../context/memory_center.ts";

const memory = new MemoryCenter();

console.log("🚀 UQTL API Server starting on http://localhost:8787");

serve({
  port: 8787,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS Headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Content-Type": "application/json",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    try {
      // Endpoint: GET /api/uqtl
      if (url.pathname === "/api/uqtl") {
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);
        const events = memory.getEvents(limit);
        return new Response(JSON.stringify(events), { headers });
      }

      // Endpoint: GET /api/stats
      if (url.pathname === "/api/stats") {
        const successes = memory.getRecentSuccesses(10);
        const failures = memory.getRecentFailures(10);
        return new Response(JSON.stringify({ successes, failures }), {
          headers,
        });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers,
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers,
      });
    }
  },
});
