import type { FastifyInstance } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

interface McpToolServices {
  reviewSop: (input: unknown) => Promise<Record<string, unknown>>;
  generateRehearsal: (input: unknown) => Promise<Record<string, unknown>>;
  evaluateDecision: (input: unknown) => Promise<Record<string, unknown>>;
  compareSopVersions: (input: unknown) => Promise<Record<string, unknown>>;
}

const sopInput = z
  .object({
    title: z.string().min(1).max(160),
    content: z.string().min(1).max(60_000),
    locale: z.string().max(32).optional(),
  })
  .strict();

function result(content: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(content) }],
    structuredContent: content,
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : 'Tool execution failed';
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

export function registerMcpEndpoint(app: FastifyInstance, services: McpToolServices): void {
  const createServer = () => {
    const server = new McpServer({
      name: 'sopscape-council',
      version: '0.1.0',
    });

    server.registerTool(
      'review_sop',
      {
        title: 'Review SOP',
        description: 'Run the council review and persist a traceable SOP passport.',
        inputSchema: sopInput,
      },
      async (input) => {
        try {
          return result(await services.reviewSop(input));
        } catch (error) {
          return errorResult(error);
        }
      },
    );

    server.registerTool(
      'generate_rehearsal',
      {
        title: 'Generate Decision Rehearsal',
        description: 'Generate a branching phishing-response rehearsal from an SOP.',
        inputSchema: sopInput,
      },
      async (input) => {
        try {
          return result(await services.generateRehearsal(input));
        } catch (error) {
          return errorResult(error);
        }
      },
    );

    server.registerTool(
      'evaluate_decision',
      {
        title: 'Evaluate Decision',
        description: 'Score a decision node choice and persist the audit trail.',
        inputSchema: z
          .object({
            rehearsalId: z.string().min(1),
            nodeId: z.string().min(1),
            choiceId: z.string().min(1),
          })
          .strict(),
      },
      async (input) => {
        try {
          return result(await services.evaluateDecision(input));
        } catch (error) {
          return errorResult(error);
        }
      },
    );

    server.registerTool(
      'compare_sop_versions',
      {
        title: 'Compare SOP Versions',
        description: 'Compare two SOP versions and identify readiness regressions.',
        inputSchema: z
          .object({
            previous: z.string().min(1).max(60_000),
            current: z.string().min(1).max(60_000),
            previousCouncil: z.unknown(),
            currentCouncil: z.unknown(),
          })
          .strict(),
      },
      async (input) => {
        try {
          return result(await services.compareSopVersions(input));
        } catch (error) {
          return errorResult(error);
        }
      },
    );

    return server;
  };

  app.post('/mcp', async (request, reply) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    let closed = false;
    const close = async () => {
      if (closed) return;
      closed = true;
      await transport.close();
      await server.close();
    };
    try {
      await server.connect(transport);
      reply.raw.once('close', () => {
        void close();
      });
      reply.hijack();
      await transport.handleRequest(request.raw, reply.raw, request.body);
      return reply;
    } catch (error) {
      await close();
      if (!reply.raw.headersSent) {
        return reply.code(500).send({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal MCP error' },
          id: null,
        });
      }
      throw error;
    }
  });

  const methodNotAllowed = {
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  };
  app.get('/mcp', async (_request, reply) => reply.code(405).send(methodNotAllowed));
  app.delete('/mcp', async (_request, reply) => reply.code(405).send(methodNotAllowed));
}
