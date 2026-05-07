import { inject } from '@angular/core'
import { CanActivateFn, Router } from '@angular/router'
import { AuthService } from '../services/auth.service'

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService)
  const router = inject(Router)

  const ok = await auth.checkAuth()
  if (!ok) {
    // Redirect to CF Access login — the browser will be redirected there automatically
    // by CF Access if the cookie is missing. This is a fallback.
    router.navigate(['/'])
    return false
  }
  return true
}
