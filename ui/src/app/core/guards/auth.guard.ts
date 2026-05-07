import { inject } from '@angular/core'
import { CanActivateFn } from '@angular/router'
import { AuthService } from '../services/auth.service'

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService)

  const ok = await auth.checkAuth()
  if (!ok) {
    // CF Access only intercepts real HTTP requests, not SPA navigation.
    // Always force a full page reload — CF Access redirects to login if not
    // authenticated, or immediately back to /admin if already logged in.
    window.location.href = '/admin'
    return false
  }
  return true
}
