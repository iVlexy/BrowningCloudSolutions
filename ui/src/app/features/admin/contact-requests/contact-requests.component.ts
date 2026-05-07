import { Component, inject, OnInit, signal } from '@angular/core'
import { MatTableModule } from '@angular/material/table'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { DatePipe } from '@angular/common'
import { ApiService } from '../../../core/services/api.service'
import type { ContactRequest } from '../../../shared/models'

@Component({
  selector: 'app-contact-requests',
  standalone: true,
  imports: [
    DatePipe, MatTableModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Contact Requests</h1>
          <p class="page-sub">
            {{ unreadCount() }} unread
          </p>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-row"><mat-spinner diameter="32" /></div>
      } @else {
        <div class="requests-list">
          @for (req of requests(); track req.id) {
            <div class="request-card {{ req.isRead ? 'read' : 'unread' }}">
              <div class="req-header">
                <div class="req-name">
                  @if (!req.isRead) { <span class="unread-dot"></span> }
                  {{ req.name }}
                  @if (req.company) { <span class="company"> · {{ req.company }}</span> }
                </div>
                <div class="req-date">{{ req.createdAt * 1000 | date:'medium' }}</div>
              </div>
              <div class="req-contact">
                <a [href]="'mailto:' + req.email">{{ req.email }}</a>
                @if (req.phone) { <span> · {{ req.phone }}</span> }
              </div>
              <div class="req-message">{{ req.message }}</div>
              <div class="req-actions">
                @if (!req.isRead) {
                  <button mat-stroked-button (click)="markRead(req)">
                    <mat-icon>mark_email_read</mat-icon>Mark as Read
                  </button>
                }
                <a mat-flat-button [href]="'mailto:' + req.email" class="reply-btn">
                  <mat-icon>reply</mat-icon>Reply
                </a>
                <button mat-icon-button color="warn" (click)="deleteRequest(req)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          }

          @if (requests().length === 0) {
            <div class="empty-state">
              <mat-icon>mark_email_unread</mat-icon>
              <p>No contact requests yet.</p>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;
      h1 { margin: 0; font-size: 24px; font-weight: 700; }
      .page-sub { margin: 4px 0 0; color: #666; font-size: 14px; }
    }

    .loading-row { display: flex; justify-content: center; padding: 48px; }

    .requests-list { display: flex; flex-direction: column; gap: 12px; }

    .request-card {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e8edf2;
      padding: 20px;
      transition: box-shadow 0.15s;

      &.unread { border-left: 3px solid #1565C0; }
    }

    .req-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;
    }

    .req-name {
      font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 6px;
      .company { font-weight: 400; color: #888; }
    }

    .unread-dot {
      width: 8px; height: 8px; background: #1565C0; border-radius: 50; flex-shrink: 0;
    }

    .req-date { font-size: 12px; color: #aaa; }
    .req-contact { font-size: 13px; color: #1565C0; margin-bottom: 10px; a { color: #1565C0; } }
    .req-message { font-size: 14px; color: #444; line-height: 1.6; margin-bottom: 16px; }

    .req-actions { display: flex; gap: 8px; align-items: center; }
    .reply-btn { background: #1565C0 !important; color: #fff !important; }

    .empty-state {
      text-align: center; padding: 64px; background: #fff;
      border-radius: 12px; border: 1px solid #e8edf2;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #ccc; }
      p { color: #888; margin: 8px 0 0; }
    }
  `],
})
export class ContactRequestsComponent implements OnInit {
  private api = inject(ApiService)
  private snack = inject(MatSnackBar)

  requests = signal<ContactRequest[]>([])
  loading = signal(true)
  unreadCount = () => this.requests().filter((r) => !r.isRead).length

  ngOnInit() { this.load() }

  load() {
    this.loading.set(true)
    this.api.getContactRequests().subscribe({
      next: (data) => { this.requests.set(data); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  markRead(req: ContactRequest) {
    this.api.markContactRead(req.id).subscribe({
      next: () => this.requests.update((reqs) => reqs.map((r) => r.id === req.id ? { ...r, isRead: true } : r)),
      error: () => this.snack.open('Failed to mark as read', 'Dismiss', { duration: 3000 }),
    })
  }

  deleteRequest(req: ContactRequest) {
    if (!confirm('Delete this request?')) return
    this.api.deleteContactRequest(req.id).subscribe({
      next: () => { this.snack.open('Deleted', '', { duration: 2000 }); this.load() },
      error: () => this.snack.open('Failed to delete', 'Dismiss', { duration: 3000 }),
    })
  }
}
