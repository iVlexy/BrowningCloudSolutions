import { inject } from '@angular/core'
import { CanActivateFn } from '@angular/router'
import { AuthService } from '../services/auth.service'

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService)

  const ok = await auth.checkAuth()
  if (!ok) {
    window.location.href = `https://browningcloudsolutions.cloudflareaccess.com/cdn-cgi/access/login/${window.location.hostname}?redirect_url=${encodeURIComponent(window.location.href)}`
    return false
  }
  return true
}
