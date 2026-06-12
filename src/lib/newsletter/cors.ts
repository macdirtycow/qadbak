import { NextResponse } from "next/server";

export function newsletterCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function newsletterJsonResponse(
  body: unknown,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: newsletterCorsHeaders(),
  });
}

export function newsletterOptionsResponse(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: newsletterCorsHeaders(),
  });
}
