import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { db, eq, schema } from "@/lib/db";
import { DELETE_LIMIT, DELETE_LIMIT_DURATION } from "@/lib/ratelimitValues";
import { ingestAuditLogs } from "@/lib/tinybird";
import { rateLimitedProcedure } from "../../trpc";

export const deleteLlmGateway = rateLimitedProcedure({
  limit: DELETE_LIMIT,
  duration: DELETE_LIMIT_DURATION,
})
  .input(z.object({ gatewayId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const llmGateway = await db.query.llmGateways.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, input.gatewayId)),
      with: {
        workspace: {
          columns: {
            id: true,
            tenantId: true,
          },
        },
      },
    });

    if (!llmGateway || llmGateway.workspace.tenantId !== ctx.tenant.id) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "LLM gateway not found. please contact support using support@unkey.dev.",
      });
    }

    await db
      .delete(schema.llmGateways)
      .where(eq(schema.llmGateways.id, input.gatewayId))
      .catch((_err) => {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "We are unable to delete the LLM gateway. Please contact support using support@unkey.dev",
        });
      });
    await ingestAuditLogs({
      workspaceId: llmGateway.workspace.id,
      actor: {
        type: "user",
        id: ctx.user.id,
      },
      event: "llmGateway.delete",
      description: `Deleted ${llmGateway.id}`,
      resources: [
        {
          type: "gateway",
          id: llmGateway.id,
        },
      ],
      context: {
        location: ctx.audit.location,
        userAgent: ctx.audit.userAgent,
      },
    });

    return {
      id: llmGateway.id,
    };
  });
