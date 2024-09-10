import { db, schema } from "@/lib/db";
import { ingestAuditLogs } from "@/lib/tinybird";
import { TRPCError } from "@trpc/server";
import { newId } from "@unkey/id";
import { z } from "zod";
import { CREATE_LIMIT, CREATE_LIMIT_DURATION } from "@/lib/ratelimitValues";
import { rateLimitedProcedure } from "../../trpc";

const nameSchema = z
  .string()
  .min(3)
  .regex(/^[a-zA-Z0-9_:\-\.\*]+$/, {
    message:
      "Must be at least 3 characters long and only contain alphanumeric, colons, periods, dashes and underscores",
  });

export const createRole = rateLimitedProcedure({ limit: CREATE_LIMIT, duration: CREATE_LIMIT_DURATION })
  .input(
    z.object({
      name: nameSchema,
      description: z.string().optional(),
      permissionIds: z.array(z.string()).optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const workspace = await db.query.workspaces.findFirst({
      where: (table, { and, eq, isNull }) =>
        and(eq(table.tenantId, ctx.tenant.id), isNull(table.deletedAt)),
    });

    if (!workspace) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message:
          "We are unable to find the correct workspace. Please contact support using support@unkey.dev.",
      });
    }
    const roleId = newId("role");
    await db
      .insert(schema.roles)
      .values({
        id: roleId,
        name: input.name,
        description: input.description,
        workspaceId: workspace.id,
      })
      .catch((_err) => {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "We are unable to create a role. Please contact support using support@unkey.dev.",
        });
      });
    await ingestAuditLogs({
      workspaceId: workspace.id,
      event: "role.create",
      actor: {
        type: "user",
        id: ctx.user.id,
      },
      description: `Created ${roleId}`,
      resources: [
        {
          type: "role",
          id: roleId,
        },
      ],

      context: {
        userAgent: ctx.audit.userAgent,
        location: ctx.audit.location,
      },
    });

    if (input.permissionIds && input.permissionIds.length > 0) {
      await db.insert(schema.rolesPermissions).values(
        input.permissionIds.map((permissionId) => ({
          permissionId,
          roleId: roleId,
          workspaceId: workspace.id,
        })),
      );
      await ingestAuditLogs(
        input.permissionIds.map((permissionId) => ({
          workspaceId: workspace.id,
          event: "authorization.connect_role_and_permission",
          actor: {
            type: "user",
            id: ctx.user.id,
          },
          description: `Connected ${roleId} and ${permissionId}`,
          resources: [
            { type: "role", id: roleId },
            {
              type: "permission",
              id: permissionId,
            },
          ],

          context: {
            userAgent: ctx.audit.userAgent,
            location: ctx.audit.location,
          },
        })),
      );
    }
    return { roleId };
  });
