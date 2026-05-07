const WORKER_URL = 'https://bcs-api.browningethan23.workers.dev'

export async function onRequest(context: EventContext<Record<string, unknown>, string, Record<string, unknown>>) {
  const { request } = context
  const url = new URL(request.url)

  // Rewrite origin to the Worker, preserve path + query
  const workerUrl = new URL(url.pathname + url.search, WORKER_URL)

  const workerRequest = new Request(workerUrl.toString(), {
    method: request.method,
    headers: request.headers, // forwards CF_Authorization cookie
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  })

  const response = await fetch(workerRequest)

  // Strip Worker's CORS headers — same-origin now, not needed
  const headers = new Headers(response.headers)
  headers.delete('access-control-allow-origin')
  headers.delete('access-control-allow-credentials')
  headers.delete('access-control-allow-methods')
  headers.delete('access-control-allow-headers')
  headers.delete('access-control-max-age')

  return new Response(response.body, { status: response.status, headers })
}
