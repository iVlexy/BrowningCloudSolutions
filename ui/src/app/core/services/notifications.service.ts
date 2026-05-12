import { Injectable, inject, signal, computed } from '@angular/core'
import { ApiService } from './api.service'

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private api = inject(ApiService)

  notifications = signal<any[]>([])
  unreadCount = computed(() => this.notifications().filter((n) => !n.isRead).length)

  load() {
    this.api.getNotifications().subscribe({
      next: (res) => this.notifications.set(res.notifications ?? []),
      error: () => {},
    })
  }

  markRead(id: string) {
    this.api.markNotificationRead(id).subscribe(() => {
      this.notifications.update((list) =>
        list.map((n) => n.id === id ? { ...n, isRead: true } : n)
      )
    })
  }

  markAllRead() {
    this.api.markAllNotificationsRead().subscribe(() => {
      this.notifications.update((list) => list.map((n) => ({ ...n, isRead: true })))
    })
  }

  delete(id: string) {
    this.api.deleteNotification(id).subscribe(() => {
      this.notifications.update((list) => list.filter((n) => n.id !== id))
    })
  }
}
