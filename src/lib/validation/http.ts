import { ZodError, type ZodTypeAny } from "zod";
import { NextResponse } from "next/server";

export const parseJsonBody = async <TSchema extends ZodTypeAny>(
  req: Request,
  schema: TSchema,
) => {
  const payload = await req.json();
  return schema.parse(payload);
};

export const badRequestFromZod = (error: ZodError) =>
  NextResponse.json(
    {
      error: "Validation failed",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 },
  );
