import { useEffect, useId, useRef, useState } from 'react'

import {
  AttachmentsApiError,
  downloadAttachment,
  listAttachments,
} from '../api/attachments.api'
import type { IncidentAttachment } from '../types/attachment.types'
import { UploadAttachmentForm } from './UploadAttachmentForm'

import './AttachmentPanel.css'

interface AttachmentPanelProps {
  accessToken: string
  incidentId: number
  canUpload: boolean
  onSessionExpired: () => void
}

const PAGE_SIZE = 20

function getErrorMessage(error: unknown): string {
  if (error instanceof AttachmentsApiError) {
    return error.message
  }

  if (
    error instanceof DOMException &&
    error.name === 'TimeoutError'
  ) {
    return 'El servidor tardó demasiado. Puedes reintentar.'
  }

  return 'No se pudo completar la operación. Comprueba la conexión.'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentPanel({
  accessToken,
  incidentId,
  canUpload,
  onSessionExpired,
}: AttachmentPanelProps) {
  const headingId = useId()

  const [attachments, setAttachments] =
    useState<IncidentAttachment[]>([])
  const [offset, setOffset] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [downloadingId, setDownloadingId] =
    useState<number | null>(null)

  const downloadController = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    async function loadAttachments() {
      setIsLoading(true)
      setErrorMessage('')
      setAttachments([])

      try {
        const result = await listAttachments(
          accessToken,
          incidentId,
          offset,
          PAGE_SIZE,
          AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        )

        if (isActive) {
          setAttachments(result)
        }
      } catch (error: unknown) {
        if (!isActive) return

        if (
          error instanceof AttachmentsApiError &&
          error.status === 401
        ) {
          onSessionExpired()
          return
        }

        setErrorMessage(getErrorMessage(error))
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadAttachments()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [
    accessToken,
    incidentId,
    offset,
    reloadKey,
    onSessionExpired,
  ])

  useEffect(() => {
    setDownloadingId(null)
    setDownloadError('')

    return () => {
      downloadController.current?.abort()
      downloadController.current = null
    }
  }, [accessToken, incidentId])

  function handleRefresh() {
    setDownloadError('')
    setReloadKey((value) => value + 1)
  }

  function handleAttachmentUploaded() {
    setOffset(0)
    setDownloadError('')
    setReloadKey((value) => value + 1)
  }

  async function handleDownload(attachment: IncidentAttachment) {
    if (downloadController.current !== null) return

    const controller = new AbortController()
    downloadController.current = controller

    setDownloadingId(attachment.id)
    setDownloadError('')

    try {
      const blob = await downloadAttachment(
        accessToken,
        incidentId,
        attachment.id,
        AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(30_000),
        ]),
      )

      if (controller.signal.aborted) return

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      try {
        link.href = url
        link.download = attachment.original_filename
        document.body.appendChild(link)
        link.click()
      } finally {
        link.remove()

        window.setTimeout(() => {
          URL.revokeObjectURL(url)
        }, 60_000)
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) return

      if (
        error instanceof AttachmentsApiError &&
        error.status === 401
      ) {
        onSessionExpired()
        return
      }

      setDownloadError(getErrorMessage(error))
    } finally {
      if (downloadController.current === controller) {
        downloadController.current = null
        setDownloadingId(null)
      }
    }
  }

  return (
    <section
      className="attachment-panel"
      aria-labelledby={headingId}
    >
      <div className="section-heading">
        <div>
          <h3 id={headingId}>Archivos adjuntos</h3>

          <p className="page-description">
            Evidencias y documentos relacionados con esta incidencia.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={isLoading}
          onClick={handleRefresh}
        >
          Actualizar adjuntos
        </button>
      </div>

      {canUpload ? (
        <UploadAttachmentForm
          key={incidentId}
          accessToken={accessToken}
          incidentId={incidentId}
          disabled={isLoading || Boolean(errorMessage)}
          onAttachmentUploaded={handleAttachmentUploaded}
          onSessionExpired={onSessionExpired}
        />
      ) : (
        <p className="page-description">
          Esta incidencia está cerrada. Puedes consultar y
          descargar sus adjuntos.
        </p>
      )}

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">Cargando adjuntos…</p>
        ) : errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : attachments.length === 0 ? (
          <p>
            {offset === 0
              ? 'Esta incidencia todavía no tiene archivos adjuntos.'
              : 'No hay archivos adjuntos en esta página.'}
          </p>
        ) : (
          <ul className="attachment-list">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="attachment-item"
              >
                <div className="attachment-information">
                  <strong>
                    {attachment.original_filename}
                  </strong>

                  <span>
                    {formatFileSize(attachment.file_size_bytes)}
                    {' · '}
                    {attachment.content_type}
                  </span>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={downloadingId !== null}
                  aria-label={
                    `Descargar ${attachment.original_filename}`
                  }
                  onClick={() => void handleDownload(attachment)}
                >
                  {downloadingId === attachment.id
                    ? 'Descargando…'
                    : 'Descargar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {downloadingId !== null && (
        <p role="status">Preparando la descarga…</p>
      )}

      {downloadError && (
        <p className="form-error" role="alert">
          {downloadError}
        </p>
      )}

      <div className="pagination">
        <button
          type="button"
          className="secondary-button"
          disabled={isLoading || offset === 0}
          onClick={() =>
            setOffset((value) => Math.max(0, value - PAGE_SIZE))
          }
        >
          Anterior
        </button>

        <span>Página {offset / PAGE_SIZE + 1}</span>

        <button
          type="button"
          className="secondary-button"
          disabled={
            isLoading ||
            Boolean(errorMessage) ||
            attachments.length < PAGE_SIZE
          }
          onClick={() => setOffset((value) => value + PAGE_SIZE)}
        >
          Siguiente
        </button>
      </div>
    </section>
  )
}