import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { skillRegistry } from "../registry.ts";
import type { Skill } from "../types.ts";

/**
 * 🔗 MCPサーバーを ts-agent のスキルとして繋げるためのアダプターだよ！
 */
export class McpAdapter {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  constructor(
    private serverCommand: string,
    private serverArgs: string[] = [],
  ) {}

  /**
   * MCPサーバーに接続して、ツールをスキルとして登録するよっ！✨
   */
  public async connectAndRegister(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: this.serverCommand,
      args: this.serverArgs,
    });

    this.client = new Client(
      { name: "ts-agent-mcp-client", version: "1.0.0" },
      { capabilities: {} },
    );

    await this.client.connect(this.transport);

    // ツールの一覧を取得するよ！📂
    const toolsResult = await this.client.listTools();

    for (const tool of toolsResult.tools) {
      const skill: Skill = {
        name: tool.name,
        description: tool.description || `MCP Tool: ${tool.name}`,
        schema: z.any() as any, // 簡易化のため any にしてるけど、本来は tool.inputSchema から変換するといいよ！
        execute: async (args: any) => {
          if (!this.client) throw new Error("MCP client not connected");
          const result = await this.client.callTool({
            name: tool.name,
            arguments: args,
          });
          return result;
        },
      };
      skillRegistry.register(skill);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
    }
  }
}
