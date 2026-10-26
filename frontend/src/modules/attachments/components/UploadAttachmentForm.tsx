import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import {
  AttachmentsApiError,
  uploadAttachment,
} from '../api/attachments.api'

interface UploadAttachmentFormProps {
  accessToken: string
  incidentId: number
  disabled?: boolean
  onAttachmentUploaded: () => void
  onSessionExpired: () => void
}

export function UploadAttachmentForm({
  accessToken,
  incidentId,
  disabled = false,
  onAttachmentUploaded,
  onSessionExpired,
}: UploadAttachmentFormProps) {
  const inputId = useId()
  const helpId = useId()

  const inputRef = useRef<HTMLInputElement>(null)
  const submissionInProgress = useRef(false)
  const isActive = useRef(false)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    isActive.current = true

    return () => {
      isActive.current = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (disabled || submissionInProgress.current) return

    setErrorMessage('')
    setSuccessMessage('')

    if (!selectedFile) {
      setErrorMessage('Selecciona un archivo.')
      return
    }

    if (selectedFile.size === 0) {
      setErrorMessage('El archivo seleccionado está vacío.')
      return
    }

    if (!/\.(png|jpe?g|pdf)$/i.test(selectedFile.name)) {
      setErrorMessage('Selecciona una imagen PNG, JPEG o un PDF.')
      return
    }

    submissionInProgress.current = true
    setIsSubmitting(true)

    try {
      await uploadAttachment(
        accessToken,
        incidentId,
        selectedFile,
      )

      if (!isActive.current) return

      setSelectedFile(null)

      if (inputRef.current) {
        inputRef.current.value = ''
      }

      setSuccessMessage('Archivo adjuntado correctamente.')
      onAttachmentUploaded()
    } catch (error: unknown) {
      if (!isActive.current) return

      if (
        error instanceof AttachmentsApiError &&
        error.status === 401
      ) {
        onSessionExpired()
        return
      }

      setErrorMessage(
        error instanceof AttachmentsApiError
          ? error.message
          : 'No se pudo confirmar la carga. Actualiza el listado antes de reintentar para evitar duplicados.',
      )
    } finally {
      submissionInProgress.current = false

      if (isActive.current) {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <form
      className="attachment-upload-form"
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
    >
      <fieldset disabled={disabled || isSubmitting}>
        <legend>Adjuntar evidencia</legend>

        <label htmlFor={inputId}>
          Selecciona una imagen o un PDF
        </label>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          name="file"
          accept=".png,.jpg,.jpeg,.pdf"
          required
          aria-describedby={helpId}
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null)
            setErrorMessage('')
            setSuccessMessage('')
          }}
        />

        <p id={helpId} className="page-description">
          Puedes subir un archivo por vez. El sistema comprobará
          el contenido, el tamaño y la cantidad permitida.
          Los PDF deben estar sin contraseña.
        </p>

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p role="status">{successMessage}</p>
        )}

        {isSubmitting && (
          <p role="status">Subiendo archivo…</p>
        )}

        <button
          type="submit"
          className="primary-button"
          disabled={
            disabled ||
            isSubmitting ||
            selectedFile === null
          }
        >
          {isSubmitting ? 'Subiendo…' : 'Adjuntar archivo'}
        </button>
      </fieldset>
    </form>
  )
}