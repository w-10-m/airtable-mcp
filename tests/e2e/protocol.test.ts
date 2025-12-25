import { McpTestClient } from './helpers/mcp-client';

describe('JSON-RPC Protocol', () => {
  let client: McpTestClient;

  beforeEach(async () => {
    client = new McpTestClient();
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
  });

  describe('request/response', () => {
    it('returns tools/list with all tools', async () => {
      const tools = await client.listTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('returns error for unknown method', async () => {
      await expect(client.request('unknown/method')).rejects.toThrow();
    });

    it('includes all expected Airtable tools', async () => {
      const tools = await client.listTools();
      const toolNames = tools.map(t => t.name);

      const expectedTools = [
        'airtable_create_field',
        'airtable_create_records',
        'airtable_create_table',
        'airtable_create_view',
        'airtable_delete_records',
        'airtable_delete_view',
        'airtable_get_base_schema',
        'airtable_get_record',
        'airtable_get_table',
        'airtable_get_view',
        'airtable_list_bases',
        'airtable_list_records',
        'airtable_list_views',
        'airtable_replace_records',
        'airtable_update_field',
        'airtable_update_records',
        'airtable_update_table',
        'airtable_update_view'
      ];

      for (const tool of expectedTools) {
        expect(toolNames).toContain(tool);
      }
    });
  });

  describe('error handling', () => {
    it('returns error for missing required parameters', async () => {
      await expect(client.callTool('airtable_create_records', {})).rejects.toThrow();
    });

    it('returns error for non-existent tool', async () => {
      await expect(client.callTool('non_existent_tool', {})).rejects.toThrow();
    });

    it('returns API error when credentials are invalid', async () => {
      await expect(client.callTool('airtable_list_bases', {})).rejects.toThrow();
    });
  });

  describe('notifications', () => {
    it('can send notifications', () => {
      expect(() => {
        client.sendNotification('notifications/initialized', {});
      }).not.toThrow();
    });

    it('can send cancellation notification', () => {
      expect(() => {
        client.sendCancellation('request-123', 'User cancelled');
      }).not.toThrow();
    });
  });

  describe('tool schema validation', () => {
    it('each tool has required schema properties', async () => {
      const tools = await client.listTools();
      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });

    it('airtable_create_records has a valid input schema', async () => {
      const tools = await client.listTools();
      const createRecordsTool = tools.find(t => t.name === 'airtable_create_records');
      expect(createRecordsTool).toBeDefined();
      expect(createRecordsTool!.inputSchema).toBeDefined();
      expect(createRecordsTool!.inputSchema.type).toBe('object');
      expect(createRecordsTool!.inputSchema.properties).toBeDefined();
    });
  });
});
