import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { ddb, TABLE_NAME, getUserId, response } from "./shared.js";

// Input validation schema — strict whitelist
const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).trim().optional().default(""),
  priority: z.enum(["raw", "heating", "hammering", "cooling", "forged"]).optional().default("raw"),
});

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const userId = getUserId(event);
  if (!userId) return response(401, { error: "Unauthorized" });

  // Parse and validate input
  let body: unknown;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }

  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return response(400, {
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { title, description, priority } = parsed.data;
  const taskId = randomUUID();
  const now = new Date().toISOString();

  const task = {
    userId,
    taskId,
    title,
    description,
    priority,
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: task,
      ConditionExpression: "attribute_not_exists(taskId)", // Prevent overwrite
    })
  );

  return response(201, task);
}
