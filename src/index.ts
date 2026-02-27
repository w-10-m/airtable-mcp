#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  CancelledNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { loadConfig, validateConfig } from './config.js';
import { LogShipper } from './services/log-shipper.js';
import { Logger } from './services/logger.js';
import { RequestTracker } from './services/request-tracker.js';
import { ProgressReporter } from './services/progress-reporter.js';

// Load environment variables
config();

// Import tools from each template
import { AirtableTools } from './tools/airtable-tools.js';
import { AirtableClient } from './clients/airtable-client.js';

// Import OAuth clients only if OAuth is enabled globally

// Import unified OAuth clients for special cases

class AirtableMcpServer {
  private server: Server;
  private logShipper!: LogShipper;
  private logger!: Logger;
  private requestTracker!: RequestTracker;
  private progressReporter!: ProgressReporter;
  
  // Initialize template tools
  private airtableTools: AirtableTools;
  private airtableClient: AirtableClient;
  
  // OAuth clients

  constructor() {
    // Initialize logging first
    this.initializeLogging();
    
    this.server = new Server(
      {
        name: 'airtable-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize OAuth clients first

    // Initialize template clients and tools
    // Regular client - pass configuration object
    this.airtableClient = new AirtableClient({
      authToken: process.env.AIRTABLE_ACCESS_TOKEN,
      aIRTABLEACCESSTOKEN: process.env.AIRTABLE_ACCESS_TOKEN,
      api_version: "v0",
      logger: this.logger
    });
    this.airtableTools = new AirtableTools(this.airtableClient);

    this.setupHandlers();
    this.setupNotificationHandlers();
  }

  private initializeLogging() {
    const config = loadConfig();
    const validation = validateConfig(config);
    
    if (!validation.isValid) {
      console.error('Configuration validation failed:', validation.errors);
      process.exit(1);
    }
    
    this.logShipper = new LogShipper(config.logShipping);
    this.logger = new Logger({
      logLevel: config.logShipping.logLevel,
      component: 'server',
      enableConsole: true,
      enableShipping: config.logShipping.enabled,
      serverName: 'airtable-mcp',
      logShipper: this.logShipper
    });
    
    this.logger.info('SERVER_INIT', 'MCP server initializing', {
      serverName: 'airtable-mcp',
      logShippingEnabled: config.logShipping.enabled,
      logLevel: config.logShipping.logLevel
    });
    
    // Initialize request tracking and progress reporting
    this.requestTracker = new RequestTracker(this.logger);
    this.progressReporter = new ProgressReporter(
      this.server,
      this.logger,
      this.requestTracker
    );
    
    // Set up periodic cleanup
    setInterval(() => {
      this.requestTracker.cleanupStaleRequests();
      this.progressReporter.cleanupCompletedRequests();
    }, 60000);
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [];
      
      // Add airtable tools
      tools.push(...this.airtableTools.getToolDefinitions());

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const requestId = (request as any).id;
      const progressToken = request.params._meta?.progressToken;
      
      // Register request for tracking
      const context = this.requestTracker.registerRequest(
        requestId,
        progressToken,
        name
      );

      try {
        // Handle airtable tools
        if (this.airtableTools.canHandle(name)) {
          return await this.airtableTools.executeTool(name, args, context, this.progressReporter);
        }

        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
      } catch (error) {
        // Check if error is due to cancellation
        if (context.abortController.signal.aborted) {
          this.logger.info('REQUEST_ABORTED', 'Request was cancelled', {
            requestId,
            toolName: name,
            reason: context.abortController.signal.reason
          });
          throw new McpError(
            ErrorCode.InternalError,
            'Request was cancelled'
          );
        }
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        // Clean up request tracking
        this.requestTracker.cleanup(requestId);
      }
    });
  }

  private setupNotificationHandlers() {
    // Handle cancellation notifications
    this.server.setNotificationHandler(CancelledNotificationSchema, async (notification) => {
      const { requestId, reason } = notification.params;

      if (requestId === undefined) {
        this.logger.debug('CANCELLATION_IGNORED', 'Cancellation ignored - no requestId provided');
        return;
      }

      this.logger.info('CANCELLATION_RECEIVED', 'Received cancellation notification', {
        requestId,
        reason
      });

      // Cancel the request
      const cancelled = this.requestTracker.cancelRequest(requestId, reason);
      
      if (!cancelled) {
        this.logger.debug('CANCELLATION_IGNORED', 'Cancellation ignored - request not found or already completed', {
          requestId
        });
      }
    });
  }

  async run() {
    const useHttp = process.env.MCP_TRANSPORT === 'http' || process.argv.includes('--http');

    // Handle graceful shutdown for log shipping
    const shutdown = async () => {
      this.logger.info('SERVER_SHUTDOWN', 'MCP server shutting down', {
        serverName: 'airtable-mcp'
      });

      // Shutdown request tracking and progress reporting
      if (this.requestTracker) {
        this.requestTracker.shutdown();
      }
      if (this.progressReporter) {
        this.progressReporter.shutdown();
      }

      // Shutdown logging
      if (this.logShipper) {
        await this.logShipper.shutdown();
      }

      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    if (useHttp) {
      await this.runHttp();
    } else {
      await this.runStdio();
    }
  }

  private async runStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.logger.info('SERVER_START', 'MCP server started successfully', {
      serverName: 'airtable-mcp',
      transport: 'stdio'
    });

    console.error('airtable-mcp MCP server running on stdio');
  }

  private async runHttp() {
    const port = parseInt(process.env.MCP_HTTP_PORT || '3000', 10);

    // Track transports per session for stateful mode
    const transports = new Map<string, StreamableHTTPServerTransport>();

    const httpServer = createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      // Health check endpoint
      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', server: 'airtable-mcp' }));
        return;
      }

      // MCP endpoint
      if (url.pathname === '/mcp') {
        // Check for existing session
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports.has(sessionId)) {
          transport = transports.get(sessionId)!;
        } else if (!sessionId && req.method === 'POST') {
          // New session - create transport and connect
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
          });

          transport.onclose = () => {
            if (transport.sessionId) {
              transports.delete(transport.sessionId);
            }
          };

          await this.server.connect(transport);

          if (transport.sessionId) {
            transports.set(transport.sessionId, transport);
          }
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad Request: No valid session' }));
          return;
        }

        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });

    httpServer.listen(port, () => {
      this.logger.info('SERVER_START', 'MCP server started successfully', {
        serverName: 'airtable-mcp',
        transport: 'http',
        port
      });
      console.error(`airtable-mcp MCP server running on http://localhost:${port}/mcp`);
    });
  }
}

const server = new AirtableMcpServer();
server.run().catch(console.error);