import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OAuth2Client } from "google-auth-library";

// Import tool registry
import { ToolRegistry } from "./tools/registry.js";

// Import transport handlers
import { StdioTransportHandler } from "./transports/stdio.js";
import {
  HttpTransportHandler,
  HttpTransportConfig,
} from "./transports/http.js";

// Import config
import { ServerConfig } from "./config/TransportConfig.js";
import { log } from "./utils.js";

export class GoogleCalendarMcpServer {
  private server: McpServer;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new McpServer({
      name: "google-calendar",
      version: "1.3.0",
    });
  }

  async initialize(): Promise<void> {
    // 3. Set up Modern Tool Definitions
    this.registerTools();

    // 4. Set up Graceful Shutdown
    this.setupGracefulShutdown();
  }

  private registerTools(): void {
    ToolRegistry.registerAll(this.server, this.executeWithHandler.bind(this));
  }

  private async executeWithHandler(
    handler: any,
    args: any
  ): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    log(
      `[${new Date().toISOString()}] Executing tool with args: ${JSON.stringify(
        args
      )}\n`
    );
    try {
      const result = await handler.runToolWithAPIKey(args);
      log(
        `[${new Date().toISOString()}] Tool execution result: ${JSON.stringify(
          result
        )}\n`
      );
      return result;
    } catch (error) {
      log(
        `[${new Date().toISOString()}] Tool execution error: ${
          error instanceof Error ? error.message : JSON.stringify(error)
        }\n`
      );
      throw error;
    }
  }

  async start(): Promise<void> {
    switch (this.config.transport.type) {
      case "stdio":
        const stdioHandler = new StdioTransportHandler(this.server);
        await stdioHandler.connect();
        break;

      case "http":
        const httpConfig: HttpTransportConfig = {
          port: this.config.transport.port,
          host: this.config.transport.host,
        };
        const httpHandler = new HttpTransportHandler(this.server, httpConfig);
        await httpHandler.connect();
        break;

      default:
        throw new Error(
          `Unsupported transport type: ${this.config.transport.type}`
        );
    }
  }

  private setupGracefulShutdown(): void {
    const cleanup = async () => {
      try {
        // McpServer handles transport cleanup automatically
        this.server.close();

        process.exit(0);
      } catch (error: unknown) {
        process.stderr.write(
          `Error during cleanup: ${
            error instanceof Error ? error.message : error
          }\n`
        );
        process.exit(1);
      }
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  }

  // Expose server for testing
  getServer(): McpServer {
    return this.server;
  }
}
