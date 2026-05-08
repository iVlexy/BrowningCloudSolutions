const WORKER_URL = "https://bcs-api.browningethan23.workers.dev"

export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
  const workerUrl = new URL(url.pathname + url.search, WORKER_URL)

  // CF strips CF-Access-Jwt-Assertion and Cookie from cross-origin subrequests.
  // Read the JWT from the CF-added assertion header first, then fall back to
  // the cookie value, and forward it as a custom header CF won't strip.
  const assertionHeader = request.headers.get("CF-Access-Jwt-Assertion")
  const existingXAuthJwt = request.headers.get("X-Auth-Jwt")  // set by Angular after first auth/me
  const cookieHeader2 = request.headers.get("cookie") ?? ""
  const cookieJwt = cookieHeader2.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1]?.trim() ?? null
  // Prefer token already sent by Angular client, then CF assertion header, then cookie (first load only)
  const cfJwt = existingXAuthJwt || assertionHeader || cookieJwt || null

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

  // Copy response headers but strip Set-Cookie — the Worker should never be
  // setting browser cookies, and forwarding them was clearing CF_Authorization.
  const headers = new Headers()
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === 'set-cookie') {
      console.log(`[proxy] Stripped Set-Cookie from Worker response: ${value.substring(0, 80)}`)
      continue
    }
    headers.set(key, value)
  }
  return new Response(response.body, { status: response.status, headers })
}