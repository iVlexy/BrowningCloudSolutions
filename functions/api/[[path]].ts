const WORKER_URL = "https://bcs-api.browningethan23.workers.dev"

export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
  const workerUrl = new URL(url.pathname + url.search, WORKER_URL)

  // Cloudflare strips the Cookie header from cross-origin subrequests.
  // Extract CF_Authorization cookie value and pass it explicitly as
  // CF-Access-Jwt-Assertion so the Worker can still validate the token.
  const cookieHeader = request.headers.get("cookie") ?? ""
  const cfAuthMatch = cookieHeader.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)
  const cfAuthToken = cfAuthMatch ? cfAuthMatch[1].trim() : null

  const forwardedHeaders = new Headers(request.headers)
  if (cfAuthToken && !forwardedHeaders.get("CF-Access-Jwt-Assertion")) {
    forwardedHeaders.set("CF-Access-Jwt-Assertion", cfAuthToken)
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