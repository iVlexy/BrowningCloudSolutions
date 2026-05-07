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

  user = signal<AuthUser | null>(null)
  loading = signal(true)

  checkAuth(): Promise<boolean> {
    return this.http
      .get<AuthUser>(`${this.baseUrl}/api/auth/me`)
      .toPromise()
      .then((user) => {
        this.user.set(user ?? null)
        this.loading.set(false)
        return !!user
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
