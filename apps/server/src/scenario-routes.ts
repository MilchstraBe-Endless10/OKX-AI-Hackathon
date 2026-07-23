// @sopscape/server — scenario API routes
// ponytail: generates ScenarioSchema from SOP input + council result.

import { generateScenario } from '@sopscape/core';
import { CouncilResultSchema, ScenarioSchema } from '@sopscape/contracts';
import type { FastifyInstance } from 'fastify';

export function registerScenarioRoutes(app: FastifyInstance): void {
  // POST /api/scenarios/generate
  app.post('/api/scenarios/generate', async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    // Validate required fields
    const sop = body.sop;
    const council = body.council;

    if (!sop || typeof sop !== 'object') {
      return reply.code(400).send({
        code: 'INVALID_SOP',
        message: 'SOP input required',
        retryable: false,
      });
    }

    if (!council || typeof council !== 'object') {
      return reply.code(400).send({
        code: 'INVALID_COUNCIL',
        message: 'Council result required',
        retryable: false,
      });
    }

    // Validate council against schema
    const councilValidated = CouncilResultSchema.safeParse(council);
    if (!councilValidated.success) {
      return reply.code(400).send({
        code: 'COUNCIL_VALIDATION_FAILED',
        message: 'Invalid council result format',
        retryable: false,
      });
    }

    // Get generation options
    const difficulty =
      (body.difficulty as 'beginner' | 'intermediate' | 'advanced') ?? 'intermediate';
    const maxPhases = (body.maxPhases as number) ?? 5;

    try {
      const scenario = await generateScenario(
        {
          title: String((sop as Record<string, unknown>).title ?? ''),
          content: String((sop as Record<string, unknown>).content ?? ''),
          locale: String((sop as Record<string, unknown>).locale ?? 'zh-CN'),
        },
        councilValidated.data,
        { difficulty, maxPhases },
      );

      // Validate generated scenario
      const scenarioValidated = ScenarioSchema.safeParse(scenario);
      if (!scenarioValidated.success) {
        return reply.code(500).send({
          code: 'SCENARIO_VALIDATION_FAILED',
          message: 'Generated scenario failed validation',
          retryable: true,
        });
      }

      return reply.code(200).send({
        scenario: scenarioValidated.data,
        mode: 'rule-based', // LLM-based when real provider configured
      });
    } catch (error) {
      return reply.code(500).send({
        code: 'SCENARIO_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      });
    }
  });

  // POST /api/scenarios/validate
  app.post('/api/scenarios/validate', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const validated = ScenarioSchema.safeParse(body);

    if (!validated.success) {
      return reply.code(400).send({
        code: 'SCENARIO_VALID_FAILED',
        errors: validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }

    return reply.code(200).send({ valid: true });
  });
}
