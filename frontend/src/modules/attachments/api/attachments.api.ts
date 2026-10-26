import type {
  IncidentAttachment,
} from '../types/attachment.types'

export class AttachmentsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AttachmentsApiError'
    this.status = status
  }
}

async function checkResponse(response: Response): Promise<void> {
  if (response.ok) return

  let message =
    response.status === 401
      ? 'La sesión ha vencido. Ingresa nuevamente.'
      : response.status === 403
        ? 'No tienes permisos para acceder a estos adjuntos.'
        : response.status === 404
          ? 'La incidencia o el adjunto no están disponibles.'
          : response.status === 413
            ? 'El archivo supera el tamaño permitido.'
            : response.status === 409
              ? 'No se puede añadir el archivo. Actualiza el listado.'
              : response.status === 422
                ? 'El archivo no cumple los requisitos.'
                : 'No se pudo completar la operación con el adjunto.'

  if (response.status === 409 || response.status === 422) {
    try {
      const body: unknown = await response.json()

      if (
        typeof body === 'object' &&
        body !== null &&
        'detail' in body &&
        typeof body.detail === 'string'
      ) {
        message = body.detail
      }
    } catch {
      // Conserva el mensaje general si no hay un JSON válido.
    }
  }

  throw new AttachmentsApiError(message, response.status)
}

export async function listAttachments(
  accessToken: string,
  incidentId: number,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<IncidentAttachment[]> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  })

  const response = await fetch(
    `/api/v1/incidents/${incidentId}/attachments?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal,
    },
  )

  await checkResponse(response)

  return (await response.json()) as IncidentAttachment[]
}

export async function uploadAttachment(
  accessToken: string,
  incidentId: number,
  file: File,
): Promise<IncidentAttachment> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(
    `/api/v1/incidents/${incidentId}/attachments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    },
  )

  await checkResponse(response)

  return (await response.json()) as IncidentAttachment
}

export async function downloadAttachment(
  accessToken: string,
  incidentId: number,
  attachmentId: number,
  signal: AbortSignal,
): Promise<Blob> {
  const response = await fetch(
    `/api/v1/incidents/${incidentId}/attachments/${attachmentId}/download`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal,
    },
  )

  await checkResponse(response)

  return response.blob()
}