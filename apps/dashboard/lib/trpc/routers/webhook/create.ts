import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { ingestAuditLogs } from "@/lib/tinybird";
import { TRPCError } from "@trpc/server";
import { AesGCM } from "@unkey/encryption";
import { sha256 } from "@unkey/hash";
import { newId } from "@unkey/id";
import { KeyV1, newKey } from "@unkey/keys";
import { z } from "zod";
import { CREATE_LIMIT, CREATE_LIMIT_DURATION } from "@/lib/ratelimitValues";
import { rateLimitedProcedure } from "../../trpc";

export const createWebhook = rateLimitedProcedure({ limit: CREATE_LIMIT, duration: CREATE_LIMIT_DURATION })
  .input(
    z.object({
      destination: z.string().url(),
    }),
  )
  .mutation(async ({ ctx }) => {
    const { UNKEY_WORKSPACE_ID, UNKEY_WEBHOOK_KEYS_API_ID } = env();
    const ws = await db.query.workspaces.findFirst({
      where: (table, { and, eq, isNull }) =>
        and(eq(table.tenantId, ctx.tenant.id), isNull(table.deletedAt)),
    });
    if (!ws) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message:
          "We are unable to find the correct workspace. Please contact support using support@unkey.dev.",
      });
    }

    const {
      key: _key,
      hash,
      start,
    } = await newKey({
      prefix: "whsec",
      byteLength: 16,
    });
    const api = await db.query.apis.findFirst({
      where: (table, { eq }) => eq(table.id, UNKEY_WEBHOOK_KEYS_API_ID),
    });
    if (!api?.keyAuthId) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Key space for webhooks is not configured",
      });
    }

    const webhookId = newId("webhook");

    const keyId = newId("key");
    await db.insert(schema.keys).values({
      id: keyId,
      keyAuthId: api.keyAuthId,
      hash,
      start,
      meta: JSON.stringify({
        webhookId,
      }),
      workspaceId: UNKEY_WORKSPACE_ID,
      createdAt: new Date(),
    });

    const permissionId = newId("permission");
    await db.insert(schema.permissions).values({
      id: permissionId,
      name: `webhook.${webhookId}.verify`,
      workspaceId: UNKEY_WORKSPACE_ID,
    });
    await db.insert(schema.keysPermissions).values({
      keyId,
      permissionId,
      workspaceId: UNKEY_WORKSPACE_ID,
    });

    await ingestAuditLogs({
      workspaceId: UNKEY_WORKSPACE_ID,
      actor: { type: "user", id: ctx.user.id },
      event: "key.create",
      description: `Created ${keyId}`,
      resources: [
        { type: "webhook", id: webhookId },
        {
          type: "key",
          id: keyId,
        },
        {
          type: "keyAuth",
          id: api.keyAuthId,
        },
        {
          type: "api",
          id: api.id,
        },
      ],
      context: {
        location: ctx.audit.location,
        userAgent: ctx.audit.userAgent,
      },
    });

    // const vault = connectVault();
    // const encrypted = await vault.encrypt({
    //   keyring: ws.id,
    //   data: key,
    // });
    // await db.insert(schema.webhooks).values({
    //   id: webhookId,
    //   workspaceId: ws.id,
    //   destination: input.destination,
    //   encrypted: encrypted.encrypted,
    //   encryptionKeyId: encrypted.keyId,
    // });

    await ingestAuditLogs({
      workspaceId: UNKEY_WORKSPACE_ID,
      actor: {
        type: "user",
        id: ctx.user.id,
      },
      event: "webhook.create",
      description: `Created ${webhookId}`,
      resources: [
        {
          type: "webhook",
          id: webhookId,
        },
      ],
      context: {
        location: ctx.audit.location,
        userAgent: ctx.audit.userAgent,
      },
    });

    return {
      id: webhookId,
    };
  });
