import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { ddb, TABLE_NAME, getUserId, response, isValidUUID } from "./shared.js";

// Only allow updating specific fields
const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(1000).trim().optional(),
  priority: z.enum(["raw", "heating", "hammering", "cooling", "forged"]).optional(),
  estimatedMinutes: z.number().min(1).max(120).optional(),
});

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const userId = getUserId(event);
  if (!userId) return response(401, { error: "Unauthorized" });

  const taskId = event.pathParameters?.taskId;
  if (!taskId || !isValidUUID(taskId)) return response(400, { error: "Invalid taskId" });

  let body: unknown;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }

  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return response(400, {
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return response(400, { error: "No fields to update" });
  }

  // Build dynamic update expression
  const expressionParts: string[] = ["#updatedAt = :now"];
  const names: Record<string, string> = { "#updatedAt": "updatedAt" };
  const values: Record<string, unknown> = { ":now": new Date().toISOString() };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      expressionParts.push(`#${key} = :${key}`);
      names[`#${key}`] = key;
      values[`:${key}`] = value;
    }
  }

  try {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { userId, taskId },
        UpdateExpression: `SET ${expressionParts.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: { ...values, ":uid": userId },
        // Ensure the task belongs to this user (defense in depth)
        ConditionExpression: "attribute_exists(userId) AND userId = :uid",
        ReturnValues: "ALL_NEW",
      })
    );

    return response(200, result.Attributes);
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
      return response(404, { error: "Task not found" });
    }
    throw err;
  }
}
