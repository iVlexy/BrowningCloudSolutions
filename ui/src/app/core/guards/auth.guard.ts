import { inject } from '@angular/core'
import { CanActivateFn } from '@angular/router'
import { AuthService } from '../services/auth.service'

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService)

  const ok = await auth.checkAuth()
  if (!ok) {
    // CF Access only intercepts real HTTP requests, not SPA navigation.
    // Avoid infinite loop: only hard-redirect if not already on /admin.
    if (!window.location.pathname.startsWith('/admin')) {
      window.location.href = '/admin'
    }
    return false
  }
  return true
}
