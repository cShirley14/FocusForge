import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { ddb, TABLE_NAME, getUserId, response } from "./shared.js";

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const userId = getUserId(event);
  if (!userId) return response(401, { error: "Unauthorized" });

  // Query only this user's tasks (partition key isolation)
  // Filter out internal records (rate limit counters etc.) in application code
  // DynamoDB doesn't allow FilterExpression on key attributes
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
      ScanIndexForward: false, // newest first by sort key
    })
  );

  const tasks = (result.Items || []).filter(
    (item) => !item.taskId?.startsWith("_")
  );

  return response(200, {
    tasks,
    count: tasks.length,
  });
}
