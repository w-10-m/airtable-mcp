# airtable-mcp

[![npm version](https://img.shields.io/npm/v/@west10tech/airtable-mcp.svg)](https://www.npmjs.com/package/@west10tech/airtable-mcp)
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/gcaliene/1752a85359f7cb8f5d2ad131b093eeba/raw/coverage.json)]()

MCP server with Airtable integration

**npm:** https://www.npmjs.com/package/@west10tech/airtable-mcp

## Available Tools

This MCP server provides 30 tools:

### Bases
- **airtable_list_bases** — List all bases
- **airtable_get_base_schema** — Get base schema including tables and fields

### Records
- **airtable_list_records** — List records in a table
- **airtable_get_record** — Get a specific record
- **airtable_search_records** — Search records by text across specified fields
- **airtable_create_records** — Create new records (up to 100, auto-batched in groups of 10)
- **airtable_update_records** — Update existing records (up to 100, auto-batched)
- **airtable_replace_records** — Replace records completely (up to 100, auto-batched)
- **airtable_delete_records** — Delete records (up to 100, auto-batched)
- **airtable_upsert_records** — Upsert records based on merge fields (up to 100, auto-batched)

### Tables & Fields
- **airtable_get_table** — Get table schema
- **airtable_create_table** — Create a new table
- **airtable_update_table** — Update table properties
- **airtable_create_field** — Create a new field in a table
- **airtable_update_field** — Update a field

### Views
- **airtable_list_views** — List views in a table
- **airtable_get_view** — Get view details
- **airtable_create_view** — Create a new view
- **airtable_update_view** — Update a view
- **airtable_delete_view** — Delete a view

### Comments
- **airtable_list_comments** — List comments on a record
- **airtable_create_comment** — Create a comment on a record
- **airtable_update_comment** — Update a comment
- **airtable_delete_comment** — Delete a comment

### Attachments
- **airtable_upload_attachment** — Upload a file attachment to a base

### Webhooks
- **airtable_list_webhooks** — List all webhooks for a base
- **airtable_create_webhook** — Create a webhook for base change notifications
- **airtable_delete_webhook** — Delete a webhook
- **airtable_refresh_webhook** — Refresh a webhook to extend its expiration
- **airtable_list_webhook_payloads** — List payloads for a webhook (cursor-based)

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

### Running the server (stdio)

The default transport is stdio, used by MCP clients like Claude Desktop and Claude Code.

```bash
# Development mode
npm run dev

# Production mode
npm run build && npm start
```

### Running the server (HTTP)

Run the server as a standalone HTTP service using the Streamable HTTP transport:

```bash
# Via environment variable
MCP_TRANSPORT=http node dist/index.js

# Via CLI flag
node dist/index.js --http

# Custom port (default: 3000)
MCP_HTTP_PORT=8080 MCP_TRANSPORT=http node dist/index.js
```

Endpoints:
- `POST /mcp` — MCP JSON-RPC endpoint (Streamable HTTP)
- `GET /health` — Health check

### Using with Claude Desktop (stdio)

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

### Using with Claude Code

Add the MCP server to your Claude Code configuration:

```json
{
  "mcpServers": {
    "airtable": {
      "command": "npx",
      "args": ["@west10tech/airtable-mcp"],
      "env": {
        "AIRTABLE_ACCESS_TOKEN": "your_airtable_access_token_here"
      }
    }
  }
}
```

### Using with an HTTP client

When running in HTTP mode, any MCP-compatible client can connect:

```json
{
  "mcpServers": {
    "airtable": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Tool Annotations

All tools include MCP annotations to help clients understand operation safety:

| Annotation | Meaning |
|-----------|---------|
| `readOnlyHint: true` | Tool only reads data, no side effects |
| `destructiveHint: true` | Tool permanently deletes or overwrites data |
| `idempotentHint: true` | Repeating the call with same args has no additional effect |

Clients like Claude Desktop can use these to warn before destructive operations (e.g., `delete_records`, `delete_view`, `delete_webhook`).

## Advanced Features

### Request Cancellation

Supports request cancellation per the [MCP cancellation spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/cancellation). Clients can cancel in-progress requests by sending a `notifications/cancelled` message.

### Progress Notifications

Supports progress notifications for long-running operations per the [MCP progress spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/utilities/progress).

To receive progress updates, include a `progressToken` in your request metadata. The server sends `notifications/progress` messages with current progress, total, and status messages.

### Detail Level Control

Several read tools support a `detail_level` parameter (`full`, `summary`, `ids_only`) to control response verbosity and reduce token usage:

- `full` — Complete response (default)
- `summary` — Key fields only (id, name, primary field)
- `ids_only` — Just record/table IDs
