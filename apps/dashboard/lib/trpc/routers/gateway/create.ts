import { db } from "@/lib/db";
import { CREATE_LIMIT, CREATE_LIMIT_DURATION } from "@/lib/ratelimitValues";
import { TRPCError } from "@trpc/server";
import { newId } from "@unkey/id";
import { z } from "zod";
import { rateLimitedProcedure } from "../../trpc";

export const createGateway = rateLimitedProcedure({
  limit: CREATE_LIMIT,
  duration: CREATE_LIMIT_DURATION,
})
  .input(
    z.object({
      subdomain: z
        .string()
        .min(1, "Workspace names must contain at least 3 characters")
        .max(50, "Workspace names must contain at most 50 characters"),
      origin: z
        .string()
        .url()
        .transform((url) => url.replace("https://", "").replace("http://", "")),

      headerRewrites: z.array(
        z.object({
          name: z.string(),
          value: z.string(),
        }),
      ),
    }),
  )
  .mutation(async ({ ctx }) => {
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

    // // const encryptionKey = getEncryptionKeyFromEnv(env());
    // // if (encryptionKey.err) {
    // //   throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "encryption key missing" });
    // // }

    // // const aes = await AesGCM.withBase64Key(encryptionKey.val.key);

    const gatewayId = newId("gateway");
    // await db.insert(schema.gateways).values({
    //   id: gatewayId,
    //   name: input.subdomain,
    //   workspaceId: ws.id,
    //   origin: input.origin,
    // });

    // const rewrites = await Promise.all(
    //   input.headerRewrites.map(async ({ name, value }) => {
    //     // const secret = //await aes.encrypt(value);

    //     return {
    //       secretId: newId("secret"),
    //       secret,
    //       name,
    //     };
    //   }),
    // );

    // if (rewrites.length > 0) {
    //   await db.insert(schema.secrets).values(
    //     rewrites.map(({ name, secretId, secret }) => ({
    //       id: secretId,
    //       algorithm: "AES-GCM" as any,
    //       ciphertext: secret.ciphertext,
    //       iv: secret.iv,
    //       name: `${input.subdomain}_${name}`,
    //       workspaceId: ws.id,
    //       keyVersion: encryptionKey.val.version,
    //       createdAt: new Date(),
    //     })),
    //   );
    //   await db.insert(schema.gatewayHeaderRewrites).values(
    //     rewrites.map(({ name, secretId }) => ({
    //       id: newId("headerRewrite"),
    //       name,
    //       secretId,
    //       createdAt: new Date(),
    //       workspaceId: ws.id,
    //       gatewayId: gatewayId,
    //     })),
    //   );
    // }

    // await ingestAuditLogs({
    //   workspaceId: ws.id,
    //   actor: {
    //     type: "user",
    //     id: ctx.user.id,
    //   },
    //   event: "gateway.create",
    //   description: `Created ${gatewayId}`,
    //   resources: [
    //     {
    //       type: "gateway",
    //       id: gatewayId,
    //     },
    //   ],
    //   context: {
    //     location: ctx.audit.location,
    //     userAgent: ctx.audit.userAgent,
    //   },
    // });

    return {
      id: gatewayId,
    };
  });
