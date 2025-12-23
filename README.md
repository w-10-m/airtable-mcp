# airtable-mcp

[![npm version](https://img.shields.io/npm/v/@west10tech/airtable-mcp.svg)](https://www.npmjs.com/package/@west10tech/airtable-mcp)

MCP server with Airtable integration

**npm:** https://www.npmjs.com/package/@west10tech/airtable-mcp

This MCP server was generated using the Template Orchestrator and includes the following integrations:

## Available Tools

This MCP server provides 18 tools across 1 integrations:

### Airtable Tools
- **airtable_list_bases**: List all bases
- **airtable_get_base_schema**: Get base schema including tables and fields
- **airtable_list_records**: List records in a table
- **airtable_get_record**: Get a specific record
- **airtable_create_records**: Create new records (up to 10 at once)
- **airtable_update_records**: Update existing records (up to 10 at once)
- **airtable_replace_records**: Replace records completely (up to 10 at once)
- **airtable_delete_records**: Delete records (up to 10 at once)
- **airtable_get_table**: Get table schema
- **airtable_create_table**: Create a new table
- **airtable_update_table**: Update table properties
- **airtable_create_field**: Create a new field in a table
- **airtable_update_field**: Update a field
- **airtable_list_views**: List views in a table
- **airtable_get_view**: Get view details
- **airtable_create_view**: Create a new view
- **airtable_update_view**: Update a view
- **airtable_delete_view**: Delete a view

## Installation

```bash
npm install @west10tech/airtable-mcp
```

## Environment Setup

Create a `.env` file with the following variables:

```env
AIRTABLE_ACCESS_TOKEN=your_airtable_access_token_here
```

## Usage

### Running the server

```bash
# Development mode
npm run dev

# Production mode
npm run build && npm start
```

### Using with Claude Desktop

Add this to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "airtable-mcp": {
      "command": "npx",
      "args": ["@west10tech/airtable-mcp"],
      "env": {
        "AIRTABLE_ACCESS_TOKEN": "your_airtable_access_token_here"
      }
    }
  }
}
```

## Instructions for Fetching API Keys/Tokens
- **COMING SOON**

## Advanced Features

### Request Cancellation

This MCP server supports request cancellation according to the [MCP cancellation specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation). Clients can cancel in-progress requests by sending a `notifications/cancelled` message with the request ID.

When a request is cancelled:
- The server immediately stops processing the request
- Any ongoing API calls are aborted
- Resources are cleaned up
- No response is sent for the cancelled request

### Progress Notifications

The server supports progress notifications for long-running operations according to the [MCP progress specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/progress). 

To receive progress updates:
1. Include a `progressToken` in your request metadata
2. The server will send `notifications/progress` messages with:
   - Current progress value
   - Total value (when known)
   - Human-readable status messages

Progress is reported for:
- Multi-step operations
- Batch processing
- Long-running API calls
- File uploads/downloads

Example progress notification:
```json
{
  "method": "notifications/progress",
  "params": {
    "progressToken": "operation-123",
    "progress": 45,
    "total": 100,
    "message": "Processing item 45 of 100..."
  }
}
```

## Generated Information

- **Generated at**: Wed Nov 26 2025 01:18:28 GMT-0500 (Eastern Standard Time)
- **Orchestrator version**: 0.0.2
- **Template repository**: Coretext-AI-Dev/server-template-v2
- **Total endpoints**: 18
