import { Injectable, inject, signal } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { environment } from '../../../environments/environment'

interface AuthUser {
  email: string
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient)
  private baseUrl = environment.apiUrl
  private authenticated = false

  user = signal<AuthUser | null>(null)
  loading = signal(true)

  checkAuth(): Promise<boolean> {
    // Only cache positive auth — on failure, always retry so that after
    // CF Access login the guard picks up the new cookie immediately.
    if (this.authenticated) {
      return Promise.resolve(true)
    }
    return this.http
      .get<AuthUser>(`${this.baseUrl}/api/auth/me`)
      .toPromise()
      .then((user) => {
        this.user.set(user ?? null)
        this.loading.set(false)
        this.authenticated = true
        return true
      })
      .catch(() => {
        this.user.set(null)
        this.loading.set(false)
        return false
      })
  }

  isAuthenticated(): boolean {
    return this.user() !== null
  }
}
