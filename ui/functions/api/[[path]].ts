const WORKER_URL = "https://bcs-api.browningethan23.workers.dev"

export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
  const workerUrl = new URL(url.pathname + url.search, WORKER_URL)
  const hasCookie = request.headers.get("cookie")?.includes("CF_Authorization") ?? false
  const hasJwt = !!request.headers.get("CF-Access-Jwt-Assertion")
  console.log("[proxy]" + request.method + " " + url.pathname + " | hasCFCookie=" + hasCookie + " hasJwt=" + hasJwt)
  const workerRequest = new Request(workerUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
  })
  const response = await fetch(workerRequest)
  console.log("[proxy] Worker responded: " + response.status)
  const headers = new Headers(response.headers)
  return new Response(response.body, { status: response.status, headers })
}