import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

// Initialize DynamoDB client once (reused across invocations)
const client = new DynamoDBClient({
  ...(process.env.IS_LOCAL === "true" && {
    endpoint: process.env.DYNAMODB_ENDPOINT || "http://localhost:8000",
    region: "us-east-1",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  }),
});

export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE_NAME = process.env.TABLE_NAME || "focusforge-tasks-local";

/**
 * Extract the authenticated user ID from the Cognito JWT claims.
 * Returns null if not authenticated (should never happen behind authorizer).
 */
export function getUserId(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): string | null {
  return event.requestContext?.authorizer?.jwt?.claims?.sub as string || null;
}

/**
 * Standard JSON response helper.
 */
export function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
    body: JSON.stringify(body),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a well-formed UUID.
 * Prevents garbage path parameters from hitting DynamoDB.
 */
export function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}
