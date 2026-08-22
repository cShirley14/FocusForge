import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { ddb, TABLE_NAME, getUserId, response, isValidUUID } from "./shared.js";

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const userId = getUserId(event);
  if (!userId) return response(401, { error: "Unauthorized" });

  const taskId = event.pathParameters?.taskId;
  if (!taskId || !isValidUUID(taskId)) return response(400, { error: "Invalid taskId" });

  try {
    await ddb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { userId, taskId },
        // Only delete if it belongs to this user
        ConditionExpression: "attribute_exists(userId) AND userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
      })
    );

    return response(200, { deleted: true, taskId });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
      return response(404, { error: "Task not found" });
    }
    throw err;
  }
}
