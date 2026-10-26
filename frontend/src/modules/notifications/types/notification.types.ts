export type NotificationType =
  | 'incident_assigned'
  | 'incident_resolved'

export interface AppNotification {
  id: number
  incident_id: number
  notification_type: NotificationType
  title: string
  message: string
  created_at: string
  read_at: string | null
}

export interface NotificationUnreadCount {
  unread_count: number
}