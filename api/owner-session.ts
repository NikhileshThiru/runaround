import type { ApiRequest, ApiResponse } from './_lib/http'
import { isOwnerRequest } from './_lib/security'

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed.' })
    return
  }
  response.status(200).json({ authenticated: isOwnerRequest(request) })
}
