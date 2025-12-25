import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as readline from 'readline';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}

export class McpTestClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<string | number, PendingRequest>();
  private notifications: JsonRpcNotification[] = [];
  private buffer = '';
  private readline: readline.Interface | null = null;
  private serverReady = false;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;

  constructor(
    private serverPath: string = path.join(__dirname, '../../../dist/index.js'),
    private defaultTimeout: number = 10000
  ) {
    super();
  }

  async start(env?: Record<string, string>): Promise<void> {
    if (this.process) {
      throw new Error('Server already running');
    }

    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    const serverEnv = {
      ...process.env,
      AIRTABLE_ACCESS_TOKEN: 'test-api-key',
      LOG_SHIPPING_ENABLED: 'false',
      ...env
    };

    this.process = spawn('node', [this.serverPath], {
      env: serverEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const message = data.toString();
      this.emit('stderr', message);

      if (message.includes('MCP server running on stdio') || message.includes('mcp MCP server running')) {
        this.serverReady = true;
        if (this.readyResolve) {
          this.readyResolve();
        }
      }
    });

    if (this.process.stdout) {
      this.readline = readline.createInterface({
        input: this.process.stdout,
        crlfDelay: Infinity
      });

      this.readline.on('line', (line: string) => {
        this.handleMessage(line);
      });
    }

    this.process.on('exit', (code, signal) => {
      this.emit('exit', { code, signal });
      this.cleanup();
    });

    this.process.on('error', (error) => {
      this.emit('error', error);
    });

    await this.waitForReady();
  }

  async waitForReady(timeout: number = 5000): Promise<void> {
    if (this.serverReady) return;

    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Server startup timeout')), timeout);
    });

    await Promise.race([this.readyPromise, timeoutPromise]);
  }

  async stop(): Promise<void> {
    const proc = this.process;
    if (!proc) return;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve();
      }, 3000);

      proc.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      proc.kill('SIGTERM');
    });
  }

  async request<T = any>(method: string, params?: any): Promise<T> {
    if (!this.process?.stdin) {
      throw new Error('Server not running');
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.defaultTimeout);

      this.pending.set(id, { resolve, reject, timeout });

      const message = JSON.stringify(request) + '\n';
      this.process!.stdin!.write(message);
    });
  }

  sendNotification(method: string, params?: any): void {
    if (!this.process?.stdin) {
      throw new Error('Server not running');
    }

    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params
    };

    const message = JSON.stringify(notification) + '\n';
    this.process.stdin.write(message);
  }

  async listTools(): Promise<Tool[]> {
    const result = await this.request<{ tools: Tool[] }>('tools/list');
    return result.tools;
  }

  async callTool(name: string, args: any, progressToken?: string): Promise<any> {
    const params: any = {
      name,
      arguments: args
    };

    if (progressToken) {
      params._meta = { progressToken };
    }

    const result = await this.request('tools/call', params);
    return result;
  }

  sendCancellation(requestId: string, reason?: string): void {
    this.sendNotification('notifications/cancelled', {
      requestId,
      reason: reason || 'User cancelled'
    });
  }

  getNotifications(method?: string): JsonRpcNotification[] {
    if (method) {
      return this.notifications.filter(n => n.method === method);
    }
    return [...this.notifications];
  }

  clearNotifications(): void {
    this.notifications = [];
  }

  waitForNotification(method: string, timeout: number = 5000): Promise<JsonRpcNotification> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off('notification', handler);
        reject(new Error(`Timeout waiting for notification: ${method}`));
      }, timeout);

      const handler = (notification: JsonRpcNotification) => {
        if (notification.method === method) {
          clearTimeout(timer);
          this.off('notification', handler);
          resolve(notification);
        }
      };

      this.on('notification', handler);

      const existing = this.notifications.find(n => n.method === method);
      if (existing) {
        clearTimeout(timer);
        this.off('notification', handler);
        resolve(existing);
      }
    });
  }

  private handleMessage(line: string): void {
    if (!line.trim()) return;

    try {
      const message = JSON.parse(line);

      if ('id' in message && message.id !== null) {
        const pending = this.pending.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pending.delete(message.id);

          if (message.error) {
            pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
          } else {
            pending.resolve(message.result);
          }
        }
      }
      else if ('method' in message) {
        this.notifications.push(message as JsonRpcNotification);
        this.emit('notification', message);
      }
    } catch (error) {
      this.emit('parse-error', { line, error });
    }
  }

  private cleanup(): void {
    this.readline?.close();
    this.readline = null;
    this.process = null;
    this.serverReady = false;

    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Server stopped'));
    }
    this.pending.clear();
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
