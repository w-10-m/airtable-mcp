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
        }
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
            }
          },
          required: ['base_id']
        }
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
            }
          },
          required: ['base_id','table_id_or_name']
        }
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
            }
          },
          required: ['base_id','table_id_or_name','record_id']
        }
      },
      {
        name: 'airtable_create_records',
        description: 'Create new records (up to 10 at once)',
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
        }
      },
      {
        name: 'airtable_update_records',
        description: 'Update existing records (up to 10 at once)',
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
        }
      },
      {
        name: 'airtable_replace_records',
        description: 'Replace records completely (up to 10 at once)',
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
        }
      },
      {
        name: 'airtable_delete_records',
        description: 'Delete records (up to 10 at once)',
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
        }
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
        }
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
        }
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
        }
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
        }
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
        }
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
        }
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
        }
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
        }
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
        }
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
        }
      }
    ];
  }

  canHandle(toolName: string): boolean {
    const supportedTools: string[] = [
      'airtable_list_bases',
      'airtable_get_base_schema',
      'airtable_list_records',
      'airtable_get_record',
      'airtable_create_records',
      'airtable_update_records',
      'airtable_replace_records',
      'airtable_delete_records',
      'airtable_get_table',
      'airtable_create_table',
      'airtable_update_table',
      'airtable_create_field',
      'airtable_update_field',
      'airtable_list_views',
      'airtable_get_view',
      'airtable_create_view',
      'airtable_update_view',
      'airtable_delete_view'
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
        case 'airtable_get_base_schema':
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
          
          result = await this.client.getBaseSchema(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed get_base_schema operation`
            });
          }
          break;
        case 'airtable_list_records':
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
          
          result = await this.client.listRecords(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed list_records operation`
            });
          }
          break;
        case 'airtable_get_record':
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
          
          result = await this.client.getRecord(args, requestOptions);
          
          // Report completion
          if (context?.progressToken && progressReporter) {
            await progressReporter.report(context.progressToken, {
              progress: 100,
              total: 100,
              message: `Completed get_record operation`
            });
          }
          break;
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