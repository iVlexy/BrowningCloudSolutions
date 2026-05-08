const WORKER_URL = "https://bcs-api.browningethan23.workers.dev"

export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
  const workerUrl = new URL(url.pathname + url.search, WORKER_URL)

  // CF strips CF-Access-Jwt-Assertion and Cookie from cross-origin subrequests.
  // Read the JWT from the CF-added assertion header first, then fall back to
  // the cookie value, and forward it as a custom header CF won't strip.
  const cfJwt =
    request.headers.get("CF-Access-Jwt-Assertion") ||
    (request.headers.get("cookie") ?? "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1]?.trim() ||
    null

  const forwardedHeaders = new Headers(request.headers)
  if (cfJwt) {
    forwardedHeaders.set("X-Auth-Jwt", cfJwt)
  }

  const workerRequest = new Request(workerUrl.toString(), {
    method: request.method,
    headers: forwardedHeaders,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
  })
  const response = await fetch(workerRequest)
  const headers = new Headers(response.headers)
  return new Response(response.body, { status: response.status, headers })
}