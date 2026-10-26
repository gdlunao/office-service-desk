export interface IncidentAttachment {
  id: number
  incident_id: number
  uploaded_by_id: number
  original_filename: string
  content_type: string
  file_size_bytes: number
  created_at: string
}