import { HttpInterceptorFn } from '@angular/common/http'

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Include cookies (CF_Authorization) with every API request
  const authReq = req.clone({ withCredentials: true })
  return next(authReq)
}
