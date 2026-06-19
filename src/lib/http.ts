import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthorizationError } from "@/lib/auth";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}
