import { Injectable, inject, signal } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { environment } from '../../../environments/environment'

interface AuthUser {
  email: string
}

interface AuthMeResponse {
  email: string
  token: string
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient)
  private baseUrl = environment.apiUrl
  private authenticated = false
  private _token = ''

  user = signal<AuthUser | null>(null)
  loading = signal(true)

  get token(): string { return this._token }

  checkAuth(): Promise<boolean> {
    // Only cache positive auth — on failure, always retry so that after
    // CF Access login the guard picks up the new cookie immediately.
    if (this.authenticated) {
      return Promise.resolve(true)
    }
    return this.http
      .get<AuthMeResponse>(`${this.baseUrl}/api/auth/me`)
      .toPromise()
      .then((res) => {
        this.user.set(res ? { email: res.email } : null)
        this._token = res?.token ?? ''
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
