import { AirtableClient } from '../clients/airtable-client.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '../services/logger.js';
import { RequestContext } from '../services/request-tracker.js';
import { ProgressReporter } from '../services/progress-reporter.js';

export interface AirtableToolsConfig {
  aIRTABLEACCESSTOKEN?: string;
  api_version?: any;
  authToken?: string;
  logger?: Logger;
}

export class AirtableTools {
  private client: AirtableClient;
  private initialized = false;
  private logger: Logger;

  constructor(client: AirtableClient) {
    this.client = client;
    
    // Get logger from client if available, otherwise create fallback
    this.logger = (client as any).logger || new Logger(
      {
        logLevel: 'ERROR',
        component: 'tools',
        enableConsole: true,
        enableShipping: false,
        serverName: ''
      }
    );
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      // Log tools initialization now that client is ready
      this.logger.info('TOOLS_INIT', 'Tools instance initialization started', { 
        integration: 'airtable',
        isOAuth: false
      });
      
      this.logger.info('CLIENT_INITIALIZATION', 'Starting client initialization', {
        isOAuth: false
      });
      
      
      this.initialized = true;
      this.logger.info('CLIENT_INITIALIZATION', 'Client initialization completed', {
        initialized: this.initialized
      });
    }
  }

  private applyDetailLevel(result: any, detailLevel: string, context: 'records' | 'schema'): any {
    if (!result?.content?.[0]?.text) return result;
    const parsed = JSON.parse(result.content[0].text);

    if (context === 'records') {
      const filterRecord = (record: any) => {
        if (detailLevel === 'ids_only') {
          return { id: record.id };
        }
        if (detailLevel === 'summary') {
          const fields = record.fields || {};
          const firstKey = Object.keys(fields)[0];
          return {
            id: record.id,
            ...(firstKey ? { primaryField: { [firstKey]: fields[firstKey] } } : {})
          };
        }
        return record;
      };

      if (Array.isArray(parsed.records)) {
        parsed.records = parsed.records.map(filterRecord);
      } else if (parsed.id) {
        const filtered = filterRecord(parsed);
        result.content[0].text = JSON.stringify(filtered, null, 2);
        return result;
      }
    } else if (context === 'schema') {
      const tables = parsed.tables || [];
      if (detailLevel === 'ids_only') {
        parsed.tables = tables.map((t: any) => ({ id: t.id, name: t.name }));
      } else if (detailLevel === 'summary') {
        parsed.tables = tables.map((t: any) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          fields: (t.fields || []).map((f: any) => ({ id: f.id, name: f.name, type: f.type }))
        }));
      }
    }

    result.content[0].text = JSON.stringify(parsed, null, 2);
    return result;
  }

  getToolDefinitions(): Tool[] {
    return [
      {
        name: 'airtable_list_bases',
        description: 'List all bases',
        inputSchema: {
          type: 'object',
          properties: {
            offset: {
              type: 'string',
              description: 'Pagination offset'
            }
          },
          required: []
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_get_base_schema',
        description: 'Get base schema including tables and fields',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID to get schema for'
            },
            detail_level: {
              type: 'string',
              enum: ['full', 'summary', 'ids_only'],
              description: 'Level of detail to return (default: full)'
            }
          },
          required: ['base_id']
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_list_records',
        description: 'List records in a table',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id_or_name: {
              type: 'string',
              description: 'Table ID or name'
            },
            fields: {
              type: 'array',
              description: 'Array of field names to return'
            },
            filterByFormula: {
              type: 'string',
              description: 'Formula to filter records'
            },
            maxRecords: {
              type: 'number',
              description: 'Maximum number of records to return (max 100)'
            },
            pageSize: {
              type: 'number',
              description: 'Number of records per page (max 100)'
            },
            sort: {
              type: 'array',
              description: 'Array of sort objects'
            },
            view: {
              type: 'string',
              description: 'View ID or name to use'
            },
            cellFormat: {
              type: 'string',
              description: 'Cell format (json or string)'
            },
            timeZone: {
              type: 'string',
              description: 'Time zone for date/time fields'
            },
            userLocale: {
              type: 'string',
              description: 'User locale for number formatting'
            },
            offset: {
              type: 'string',
              description: 'Pagination offset'
            },
            detail_level: {
              type: 'string',
              enum: ['full', 'summary', 'ids_only'],
              description: 'Level of detail to return (default: full)'
            }
          },
          required: ['base_id','table_id_or_name']
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_get_record',
        description: 'Get a specific record',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id_or_name: {
              type: 'string',
              description: 'Table ID or name'
            },
            record_id: {
              type: 'string',
              description: 'Record ID to fetch'
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of field names to return (omit for all fields). Filtered client-side.'
            },
            detail_level: {
              type: 'string',
              enum: ['full', 'summary', 'ids_only'],
              description: 'Level of detail to return (default: full)'
            }
          },
          required: ['base_id','table_id_or_name','record_id']
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_search_records',
        description: 'Search records by text across specified fields using case-insensitive matching.',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id_or_name: {
              type: 'string',
              description: 'Table ID or name'
            },
            search_term: {
              type: 'string',
              description: 'Text to search for (case-insensitive)'
            },
            field_names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Field names to search across'
            },
            maxRecords: {
              type: 'number',
              description: 'Maximum records to return (max 100)'
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Field names to include in results (omit for all)'
            },
            detail_level: {
              type: 'string',
              enum: ['full', 'summary', 'ids_only'],
              description: 'Level of detail to return (default: full)'
            }
          },
          required: ['base_id', 'table_id_or_name', 'search_term', 'field_names']
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_create_records',
        description: 'Create new records (up to 100 total, automatically batched in groups of 10)',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id_or_name: {
              type: 'string',
              description: 'Table ID or name'
            },
            records: {
              type: 'array',
              description: 'Array of record objects to create'
            },
            typecast: {
              type: 'boolean',
              description: 'Enable automatic type casting'
            }
          },
          required: ['base_id','table_id_or_name','records']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
      },
      {
        name: 'airtable_update_records',
        description: 'Update existing records (up to 100 total, automatically batched in groups of 10)',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id_or_name: {
              type: 'string',
              description: 'Table ID or name'
            },
            records: {
              type: 'array',
              description: 'Array of record objects to update'
            },
            typecast: {
              type: 'boolean',
              description: 'Enable automatic type casting'
            }
          },
          required: ['base_id','table_id_or_name','records']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_replace_records',
        description: 'Replace records completely (up to 100 total, automatically batched in groups of 10)',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id_or_name: {
              type: 'string',
              description: 'Table ID or name'
            },
            records: {
              type: 'array',
              description: 'Array of record objects to replace'
            },
            typecast: {
              type: 'boolean',
              description: 'Enable automatic type casting'
            }
          },
          required: ['base_id','table_id_or_name','records']
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
      },
      {
        name: 'airtable_delete_records',
        description: 'Delete records (up to 100 total, automatically batched in groups of 10)',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id_or_name: {
              type: 'string',
              description: 'Table ID or name'
            },
            records: {
              type: 'array',
              description: 'Array of record IDs to delete'
            }
          },
          required: ['base_id','table_id_or_name','records']
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false }
      },
      {
        name: 'airtable_upsert_records',
        description: 'Upsert records (create or update based on merge fields, up to 100 total, automatically batched in groups of 10)',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id_or_name: {
              type: 'string',
              description: 'Table ID or name'
            },
            records: {
              type: 'array',
              description: 'Array of record objects to upsert'
            },
            fieldsToMergeOn: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of field names to match existing records on'
            },
            typecast: {
              type: 'boolean',
              description: 'Enable automatic type casting'
            }
          },
          required: ['base_id', 'table_id_or_name', 'records', 'fieldsToMergeOn']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_get_table',
        description: 'Get table schema',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id: {
              type: 'string',
              description: 'Table ID to get schema for'
            }
          },
          required: ['base_id','table_id']
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_create_table',
        description: 'Create a new table',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID to create table in'
            },
            name: {
              type: 'string',
              description: 'Table name'
            },
            description: {
              type: 'string',
              description: 'Table description'
            },
            fields: {
              type: 'array',
              description: 'Array of field definitions'
            }
          },
          required: ['base_id','name','fields']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
      },
      {
        name: 'airtable_update_table',
        description: 'Update table properties',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id: {
              type: 'string',
              description: 'Table ID to update'
            },
            name: {
              type: 'string',
              description: 'New table name'
            },
            description: {
              type: 'string',
              description: 'New table description'
            }
          },
          required: ['base_id','table_id']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_create_field',
        description: 'Create a new field in a table',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id: {
              type: 'string',
              description: 'Table ID to add field to'
            },
            name: {
              type: 'string',
              description: 'Field name'
            },
            type: {
              type: 'string',
              description: 'Field type (singleLineText, multilineText, number, etc.)'
            },
            description: {
              type: 'string',
              description: 'Field description'
            },
            options: {
              type: 'object',
              description: 'Field-specific options'
            }
          },
          required: ['base_id','table_id','name','type']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
      },
      {
        name: 'airtable_update_field',
        description: 'Update a field',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id: {
              type: 'string',
              description: 'Table ID containing the field'
            },
            field_id: {
              type: 'string',
              description: 'Field ID to update'
            },
            name: {
              type: 'string',
              description: 'New field name'
            },
            description: {
              type: 'string',
              description: 'New field description'
            },
            options: {
              type: 'object',
              description: 'Updated field options'
            }
          },
          required: ['base_id','table_id','field_id']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_list_views',
        description: 'List views in a table',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id: {
              type: 'string',
              description: 'Table ID to list views for'
            }
          },
          required: ['base_id','table_id']
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_get_view',
        description: 'Get view details',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id: {
              type: 'string',
              description: 'Table ID containing the view'
            },
            view_id: {
              type: 'string',
              description: 'View ID to get details for'
            }
          },
          required: ['base_id','table_id','view_id']
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_create_view',
        description: 'Create a new view',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id: {
              type: 'string',
              description: 'Table ID to create view in'
            },
            name: {
              type: 'string',
              description: 'View name'
            },
            type: {
              type: 'string',
              description: 'View type (grid, form, calendar, etc.)'
            },
            visibleFieldIds: {
              type: 'array',
              description: 'Array of field IDs to show in view'
            },
            fieldOrder: {
              type: 'array',
              description: 'Array of field IDs defining column order'
            }
          },
          required: ['base_id','table_id','name','type']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
      },
      {
        name: 'airtable_update_view',
        description: 'Update a view',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id: {
              type: 'string',
              description: 'Table ID containing the view'
            },
            view_id: {
              type: 'string',
              description: 'View ID to update'
            },
            name: {
              type: 'string',
              description: 'New view name'
            },
            visibleFieldIds: {
              type: 'array',
              description: 'Array of field IDs to show in view'
            },
            fieldOrder: {
              type: 'array',
              description: 'Array of field IDs defining column order'
            }
          },
          required: ['base_id','table_id','view_id']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_delete_view',
        description: 'Delete a view',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id: {
              type: 'string',
              description: 'Table ID containing the view'
            },
            view_id: {
              type: 'string',
              description: 'View ID to delete'
            }
          },
          required: ['base_id','table_id','view_id']
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false }
      },
      {
        name: 'airtable_list_comments',
        description: 'List comments on a record',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id_or_name: {
              type: 'string',
              description: 'Table ID or name'
            },
            record_id: {
              type: 'string',
              description: 'Record ID to list comments for'
            },
            offset: {
              type: 'string',
              description: 'Pagination offset'
            }
          },
          required: ['base_id', 'table_id_or_name', 'record_id']
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_create_comment',
        description: 'Create a comment on a record',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id_or_name: {
              type: 'string',
              description: 'Table ID or name'
            },
            record_id: {
              type: 'string',
              description: 'Record ID to add comment to'
            },
            text: {
              type: 'string',
              description: 'Comment text'
            }
          },
          required: ['base_id', 'table_id_or_name', 'record_id', 'text']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
      },
      {
        name: 'airtable_update_comment',
        description: 'Update a comment on a record',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id_or_name: {
              type: 'string',
              description: 'Table ID or name'
            },
            record_id: {
              type: 'string',
              description: 'Record ID containing the comment'
            },
            comment_id: {
              type: 'string',
              description: 'Comment ID to update'
            },
            text: {
              type: 'string',
              description: 'Updated comment text'
            }
          },
          required: ['base_id', 'table_id_or_name', 'record_id', 'comment_id', 'text']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_delete_comment',
        description: 'Delete a comment from a record',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the table'
            },
            table_id_or_name: {
              type: 'string',
              description: 'Table ID or name'
            },
            record_id: {
              type: 'string',
              description: 'Record ID containing the comment'
            },
            comment_id: {
              type: 'string',
              description: 'Comment ID to delete'
            }
          },
          required: ['base_id', 'table_id_or_name', 'record_id', 'comment_id']
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false }
      },
      {
        name: 'airtable_upload_attachment',
        description: 'Upload a file attachment to a base',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID to upload the attachment to'
            },
            content_type: {
              type: 'string',
              description: 'MIME type of the file (e.g., image/png, application/pdf)'
            },
            file: {
              type: 'string',
              description: 'Base64-encoded file content'
            },
            filename: {
              type: 'string',
              description: 'Name of the file'
            }
          },
          required: ['base_id', 'content_type', 'file', 'filename']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
      },
      {
        name: 'airtable_list_webhooks',
        description: 'List all webhooks for a base',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID to list webhooks for'
            }
          },
          required: ['base_id']
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_create_webhook',
        description: 'Create a webhook to receive notifications for base changes',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID to create webhook for'
            },
            notificationUrl: {
              type: 'string',
              description: 'URL to receive webhook notifications'
            },
            specification: {
              type: 'object',
              description: 'Webhook specification with options like filters (e.g., { options: { filters: { dataTypes: ["tableData"], recordChangeScope: "tblXXX" } } })'
            }
          },
          required: ['base_id', 'notificationUrl']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
      },
      {
        name: 'airtable_delete_webhook',
        description: 'Delete a webhook',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the webhook'
            },
            webhook_id: {
              type: 'string',
              description: 'Webhook ID to delete'
            }
          },
          required: ['base_id', 'webhook_id']
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false }
      },
      {
        name: 'airtable_refresh_webhook',
        description: 'Refresh a webhook to extend its expiration',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the webhook'
            },
            webhook_id: {
              type: 'string',
              description: 'Webhook ID to refresh'
            }
          },
          required: ['base_id', 'webhook_id']
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
      },
      {
        name: 'airtable_list_webhook_payloads',
        description: 'List payloads for a webhook (cursor-based pagination)',
        inputSchema: {
          type: 'object',
          properties: {
            base_id: {
              type: 'string',
              description: 'Base ID containing the webhook'
            },
            webhook_id: {
              type: 'string',
              description: 'Webhook ID to get payloads for'
            },
            cursor: {
              type: 'string',
              description: 'Cursor for pagination (from previous response)'
            }
          },
          required: ['base_id', 'webhook_id']
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      }
    ];
  }

  canHandle(toolName: string): boolean {
    const supportedTools: string[] = [
      'airtable_list_bases',
      'airtable_get_base_schema',
      'airtable_list_records',
      'airtable_get_record',
      'airtable_search_records',
      'airtable_create_records',
      'airtable_update_records',
      'airtable_replace_records',
      'airtable_delete_records',
      'airtable_upsert_records',
      'airtable_get_table',
      'airtable_create_table',
      'airtable_update_table',
      'airtable_create_field',
      'airtable_update_field',
      'airtable_list_views',
      'airtable_get_view',
      'airtable_create_view',
      'airtable_update_view',
      'airtable_delete_view',
      'airtable_list_comments',
      'airtable_create_comment',
      'airtable_update_comment',
      'airtable_delete_comment',
      'airtable_upload_attachment',
      'airtable_list_webhooks',
      'airtable_create_webhook',
      'airtable_delete_webhook',
      'airtable_refresh_webhook',
      'airtable_list_webhook_payloads'
    ];
    return supportedTools.includes(toolName);
  }

  async executeTool(name: string, args: any, context?: RequestContext, progressReporter?: ProgressReporter): Promise<any> {
    const startTime = Date.now();
    
    this.logger.logToolStart(name, args);
    
    // Check for early cancellation
    if (context?.abortController.signal.aborted) {
      this.logger.info('TOOL_CANCELLED_EARLY', 'Tool execution cancelled before start', {
        tool: name,
        requestId: context.requestId
      });
      throw new Error('Request was cancelled');
    }
    
    await this.ensureInitialized();
    
    // Validate tool is supported
    if (!this.canHandle(name)) {
      this.logger.error('TOOL_ERROR', 'Unknown tool requested', {
        tool: name,
        supportedTools: ['airtable_list_bases', 'airtable_get_base_schema', 'airtable_list_records', 'airtable_get_record', 'airtable_create_records', 'airtable_update_records', 'airtable_replace_records', 'airtable_delete_records', 'airtable_get_table', 'airtable_create_table', 'airtable_update_table', 'airtable_create_field', 'airtable_update_field', 'airtable_list_views', 'airtable_get_view', 'airtable_create_view', 'airtable_update_view', 'airtable_delete_view']
      });
      throw new Error(`Unknown tool: ${name}`);
    }
    
    // Validate required parameters
    this.logger.debug('PARAM_VALIDATION', 'Validating tool parameters', {
      tool: name,
      providedArgs: Object.keys(args || {})
    });
    
    try {
      let result;
      
      // Create request options with cancellation and progress support
      const requestOptions = {
        signal: context?.abortController.signal,
        onProgress: context?.progressToken && progressReporter ? 
          progressReporter.createProgressCallback(context.progressToken) : 
          undefined
      };
      
      switch (name) {
        case 'airtable_list_bases':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_list_bases',
            clientMethod: 'listBases',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting list_bases operation...`
            });
          }
          
          result = await this.client.listBases(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed list_bases operation`
            });
          }
          break;
        case 'airtable_get_base_schema': {
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_get_base_schema',
            clientMethod: 'getBaseSchema',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });

          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting get_base_schema operation...`
            });
          }

          const { detail_level: schemaDetailLevel, ...schemaClientArgs } = args;
          result = await this.client.getBaseSchema(schemaClientArgs, requestOptions);
          if (schemaDetailLevel && schemaDetailLevel !== 'full') {
            result = this.applyDetailLevel(result, schemaDetailLevel, 'schema');
          }

          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed get_base_schema operation`
            });
          }
          break;
        }
        case 'airtable_list_records': {
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_list_records',
            clientMethod: 'listRecords',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });

          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting list_records operation...`
            });
          }

          const { detail_level: listDetailLevel, ...listClientArgs } = args;
          result = await this.client.listRecords(listClientArgs, requestOptions);
          if (listDetailLevel && listDetailLevel !== 'full') {
            result = this.applyDetailLevel(result, listDetailLevel, 'records');
          }

          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed list_records operation`
            });
          }
          break;
        }
        case 'airtable_get_record': {
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_get_record',
            clientMethod: 'getRecord',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });

          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting get_record operation...`
            });
          }

          const { detail_level: getDetailLevel, ...getClientArgs } = args;
          result = await this.client.getRecord(getClientArgs, requestOptions);

          // Client-side field filtering (Airtable get_record API doesn't support fields param)
          if (getClientArgs.fields && Array.isArray(getClientArgs.fields) && result?.content?.[0]?.text) {
            const parsed = JSON.parse(result.content[0].text);
            if (parsed.fields) {
              const filtered: Record<string, any> = {};
              for (const f of getClientArgs.fields) {
                if (f in parsed.fields) filtered[f] = parsed.fields[f];
              }
              parsed.fields = filtered;
              result.content[0].text = JSON.stringify(parsed, null, 2);
            }
          }

          if (getDetailLevel && getDetailLevel !== 'full') {
            result = this.applyDetailLevel(result, getDetailLevel, 'records');
          }

          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed get_record operation`
            });
          }
          break;
        }
        case 'airtable_search_records': {
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_search_records',
            clientMethod: 'listRecords',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });

          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting search_records operation...`
            });
          }

          const searchTerm = args.search_term.replace(/"/g, '\\"');
          const fieldNames = args.field_names as string[];
          const searchClauses = fieldNames.map((f: string) =>
            `SEARCH(LOWER("${searchTerm}"), LOWER({${f}}))`
          );
          const filterByFormula = searchClauses.length === 1
            ? searchClauses[0]
            : `OR(${searchClauses.join(', ')})`;

          const searchArgs: any = {
            base_id: args.base_id,
            table_id_or_name: args.table_id_or_name,
            filterByFormula,
            ...(args.maxRecords && { maxRecords: args.maxRecords }),
            ...(args.fields && { fields: args.fields })
          };

          result = await this.client.listRecords(searchArgs, requestOptions);

          if (args.detail_level && args.detail_level !== 'full') {
            result = this.applyDetailLevel(result, args.detail_level, 'records');
          }

          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed search_records operation`
            });
          }
          break;
        }
        case 'airtable_create_records':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_create_records',
            clientMethod: 'createRecords',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting create_records operation...`
            });
          }
          
          result = await this.client.createRecords(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed create_records operation`
            });
          }
          break;
        case 'airtable_update_records':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_update_records',
            clientMethod: 'updateRecords',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting update_records operation...`
            });
          }
          
          result = await this.client.updateRecords(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed update_records operation`
            });
          }
          break;
        case 'airtable_replace_records':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_replace_records',
            clientMethod: 'replaceRecords',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting replace_records operation...`
            });
          }
          
          result = await this.client.replaceRecords(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed replace_records operation`
            });
          }
          break;
        case 'airtable_delete_records':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_delete_records',
            clientMethod: 'deleteRecords',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting delete_records operation...`
            });
          }
          
          result = await this.client.deleteRecords(args, requestOptions);

          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed delete_records operation`
            });
          }
          break;
        case 'airtable_upsert_records':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_upsert_records',
            clientMethod: 'upsertRecords',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting upsert_records operation...`
            });
          }

          result = await this.client.upsertRecords(args, requestOptions);

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed upsert_records operation`
            });
          }
          break;
        case 'airtable_get_table':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_get_table',
            clientMethod: 'getTable',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting get_table operation...`
            });
          }
          
          result = await this.client.getTable(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed get_table operation`
            });
          }
          break;
        case 'airtable_create_table':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_create_table',
            clientMethod: 'createTable',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting create_table operation...`
            });
          }
          
          result = await this.client.createTable(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed create_table operation`
            });
          }
          break;
        case 'airtable_update_table':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_update_table',
            clientMethod: 'updateTable',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting update_table operation...`
            });
          }
          
          result = await this.client.updateTable(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed update_table operation`
            });
          }
          break;
        case 'airtable_create_field':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_create_field',
            clientMethod: 'createField',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting create_field operation...`
            });
          }
          
          result = await this.client.createField(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed create_field operation`
            });
          }
          break;
        case 'airtable_update_field':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_update_field',
            clientMethod: 'updateField',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting update_field operation...`
            });
          }
          
          result = await this.client.updateField(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed update_field operation`
            });
          }
          break;
        case 'airtable_list_views':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_list_views',
            clientMethod: 'listViews',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting list_views operation...`
            });
          }
          
          result = await this.client.listViews(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed list_views operation`
            });
          }
          break;
        case 'airtable_get_view':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_get_view',
            clientMethod: 'getView',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting get_view operation...`
            });
          }
          
          result = await this.client.getView(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed get_view operation`
            });
          }
          break;
        case 'airtable_create_view':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_create_view',
            clientMethod: 'createView',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting create_view operation...`
            });
          }
          
          result = await this.client.createView(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed create_view operation`
            });
          }
          break;
        case 'airtable_update_view':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_update_view',
            clientMethod: 'updateView',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting update_view operation...`
            });
          }
          
          result = await this.client.updateView(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed update_view operation`
            });
          }
          break;
        case 'airtable_delete_view':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_delete_view',
            clientMethod: 'deleteView',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });
          
          // Report initial progress
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0,
              total: 100,
              message: `Starting delete_view operation...`
            });
          }
          
          result = await this.client.deleteView(args, requestOptions);

          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed delete_view operation`
            });
          }
          break;
        case 'airtable_list_comments':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_list_comments',
            clientMethod: 'listComments',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0, total: 100, message: `Starting list_comments operation...`
            });
          }

          result = await this.client.listComments(args, requestOptions);

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100, total: 100, message: `Completed list_comments operation`
            });
          }
          break;
        case 'airtable_create_comment':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_create_comment',
            clientMethod: 'createComment',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0, total: 100, message: `Starting create_comment operation...`
            });
          }

          result = await this.client.createComment(args, requestOptions);

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100, total: 100, message: `Completed create_comment operation`
            });
          }
          break;
        case 'airtable_update_comment':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_update_comment',
            clientMethod: 'updateComment',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0, total: 100, message: `Starting update_comment operation...`
            });
          }

          result = await this.client.updateComment(args, requestOptions);

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100, total: 100, message: `Completed update_comment operation`
            });
          }
          break;
        case 'airtable_delete_comment':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_delete_comment',
            clientMethod: 'deleteComment',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0, total: 100, message: `Starting delete_comment operation...`
            });
          }

          result = await this.client.deleteComment(args, requestOptions);

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100, total: 100, message: `Completed delete_comment operation`
            });
          }
          break;
        case 'airtable_upload_attachment':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_upload_attachment',
            clientMethod: 'uploadAttachment',
            hasAbortSignal: !!requestOptions.signal,
            hasProgressCallback: !!requestOptions.onProgress
          });

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0, total: 100, message: `Starting upload_attachment operation...`
            });
          }

          result = await this.client.uploadAttachment(args, requestOptions);

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100, total: 100, message: `Completed upload_attachment operation`
            });
          }
          break;
        case 'airtable_list_webhooks':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_list_webhooks', clientMethod: 'listWebhooks',
            hasAbortSignal: !!requestOptions.signal, hasProgressCallback: !!requestOptions.onProgress
          });

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0, total: 100, message: `Starting list_webhooks operation...`
            });
          }

          result = await this.client.listWebhooks(args, requestOptions);

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100, total: 100, message: `Completed list_webhooks operation`
            });
          }
          break;
        case 'airtable_create_webhook':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_create_webhook', clientMethod: 'createWebhook',
            hasAbortSignal: !!requestOptions.signal, hasProgressCallback: !!requestOptions.onProgress
          });

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0, total: 100, message: `Starting create_webhook operation...`
            });
          }

          result = await this.client.createWebhook(args, requestOptions);

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100, total: 100, message: `Completed create_webhook operation`
            });
          }
          break;
        case 'airtable_delete_webhook':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_delete_webhook', clientMethod: 'deleteWebhook',
            hasAbortSignal: !!requestOptions.signal, hasProgressCallback: !!requestOptions.onProgress
          });

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0, total: 100, message: `Starting delete_webhook operation...`
            });
          }

          result = await this.client.deleteWebhook(args, requestOptions);

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100, total: 100, message: `Completed delete_webhook operation`
            });
          }
          break;
        case 'airtable_refresh_webhook':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_refresh_webhook', clientMethod: 'refreshWebhook',
            hasAbortSignal: !!requestOptions.signal, hasProgressCallback: !!requestOptions.onProgress
          });

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0, total: 100, message: `Starting refresh_webhook operation...`
            });
          }

          result = await this.client.refreshWebhook(args, requestOptions);

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100, total: 100, message: `Completed refresh_webhook operation`
            });
          }
          break;
        case 'airtable_list_webhook_payloads':
          this.logger.debug('TOOL_EXECUTE', 'Calling client method', {
            tool: 'airtable_list_webhook_payloads', clientMethod: 'listWebhookPayloads',
            hasAbortSignal: !!requestOptions.signal, hasProgressCallback: !!requestOptions.onProgress
          });

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 0, total: 100, message: `Starting list_webhook_payloads operation...`
            });
          }

          result = await this.client.listWebhookPayloads(args, requestOptions);

          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100, total: 100, message: `Completed list_webhook_payloads operation`
            });
          }
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      const duration = Date.now() - startTime;
      this.logger.logToolSuccess(name, duration, result);

      // Return raw result for non-OAuth templates
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if error is due to cancellation
      const isCancelled = context?.abortController.signal.aborted || 
                         (error instanceof Error && error.message === 'Request was cancelled');
      
      if (isCancelled) {
        this.logger.info('TOOL_CANCELLED', 'Tool execution cancelled', {
          tool: name,
          duration_ms: duration,
          requestId: context?.requestId
        });
      } else {
        this.logger.logToolError(name, error, duration, args);
      }
      throw error;
    }
  }
}