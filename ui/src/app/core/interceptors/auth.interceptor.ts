import { HttpInterceptorFn } from '@angular/common/http'
import { inject } from '@angular/core'
import { AuthService } from '../services/auth.service'

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService)
  const token = auth.token

  // Always include cookies for the initial /api/auth/me call (before we have
  // the token). Once auth/me returns the JWT, attach it as X-Auth-Jwt on all
  // subsequent calls so we don't rely on CF_Authorization cookie forwarding.
  const headers = token
    ? req.headers.set('X-Auth-Jwt', token)
    : req.headers

  return next(req.clone({ withCredentials: true, headers }))
}
