import { inject } from '@angular/core'
import { CanActivateFn } from '@angular/router'
import { AuthService } from '../services/auth.service'

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService)

  const ok = await auth.checkAuth()
  if (!ok) {
    // CF Zero Trust only intercepts real HTTP requests, not SPA navigation.
    // Force a full page reload so CF Access can intercept and show the login page.
    window.location.href = '/admin'
    return false
  }
  return true
}
