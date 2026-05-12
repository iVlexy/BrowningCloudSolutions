import { getDb } from '../db'
import { notifications } from '../db/schema'

export async function createNotification(
  db: ReturnType<typeof getDb>,
  type: string,
  message: string,
  link?: string,
) {
  await db
    .insert(notifications)
    .values({
      id: crypto.randomUUID(),
      type,
      message,
      link: link ?? null,
      isRead: false,
      createdAt: Math.floor(Date.now() / 1000),
    })
    .catch(() => {/* non-critical */})
}
