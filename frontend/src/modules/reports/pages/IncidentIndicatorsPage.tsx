import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'

import {
  getIncidentIndicators,
  ReportsApiError,
} from '../api/reports.api'
import type {
  IncidentIndicatorFilters,
  IncidentIndicators,
} from '../types/report.types'

import './IncidentIndicatorsPage.css'

interface IncidentIndicatorsPageProps {
  accessToken: string
  onSessionExpired: () => void
}

interface IndicatorCardProps {
  title: string
  value: number | null
  unit: string
  description: string
  evaluated: number
  excluded: number
  matching?: number
}

const numberFormatter = new Intl.NumberFormat('es-PE', {
  maximumFractionDigits: 2,
})

function formatDateLabel(value: string): string {
  return value.split('-').reverse().join('/')
}

function describePeriod(
  start: string | null,
  end: string | null,
): string {
  if (start && end) {
    return `Del ${formatDateLabel(start)} al ${formatDateLabel(end)}`
  }

  if (start) {
    return `Desde el ${formatDateLabel(start)}`
  }

  if (end) {
    return `Hasta el ${formatDateLabel(end)}`
  }

  return 'Todo el período disponible'
}

function IndicatorCard({
  title,
  value,
  unit,
  description,
  evaluated,
  excluded,
  matching,
}: IndicatorCardProps) {
  return (
    <article className="report-indicator-card">
      <h2>{title}</h2>

      <p className="report-indicator-value">
        {value === null
          ? 'Sin datos evaluables'
          : `${numberFormatter.format(value)} ${unit}`}
      </p>

      <p className="report-indicator-description">
        {description}
      </p>

      <dl className="report-indicator-counts">
        {matching !== undefined && (
          <div>
            <dt>Casos que cumplen</dt>
            <dd>{numberFormatter.format(matching)}</dd>
          </div>
        )}

        <div>
          <dt>Casos evaluados</dt>
          <dd>{numberFormatter.format(evaluated)}</dd>
        </div>

        <div>
          <dt>Casos excluidos</dt>
          <dd>{numberFormatter.format(excluded)}</dd>
        </div>
      </dl>
    </article>
  )
}

export function IncidentIndicatorsPage({
  accessToken,
  onSessionExpired,
}: IncidentIndicatorsPageProps) {
  const startId = useId()
  const endId = useId()
  const filterHelpId = useId()
  const filterErrorId = useId()

  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  const [appliedFilters, setAppliedFilters] =
    useState<IncidentIndicatorFilters>({
      period_start: '',
      period_end: '',
    })

  const [report, setReport] =
    useState<IncidentIndicators | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [filterError, setFilterError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 15_000)

    async function loadReport() {
      setIsLoading(true)
      setErrorMessage('')
      setReport(null)

      try {
        const result = await getIncidentIndicators(
          accessToken,
          {
            period_start: appliedFilters.period_start,
            period_end: appliedFilters.period_end,
          },
          controller.signal,
        )

        if (isActive) {
          setReport(result)
        }
      } catch (error: unknown) {
        if (!isActive) return

        if (
          error instanceof ReportsApiError &&
          error.status === 401
        ) {
          onSessionExpired()
          return
        }

        setErrorMessage(
          timedOut
            ? 'El servidor tardó demasiado. Puedes reintentar.'
            : error instanceof TypeError
              ? 'No se pudo conectar con el servidor.'
              : error instanceof Error
                ? error.message
                : 'No se pudieron cargar los indicadores.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadReport()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    accessToken,
    appliedFilters.period_start,
    appliedFilters.period_end,
    reloadKey,
    onSessionExpired,
  ])

  function handleApplyFilters(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (isLoading) return

    if (
      periodStart &&
      periodEnd &&
      periodStart > periodEnd
    ) {
      setFilterError(
        'La fecha inicial no puede ser posterior a la fecha final.',
      )
      return
    }

    setFilterError('')
    setAppliedFilters({
      period_start: periodStart,
      period_end: periodEnd,
    })
    setReloadKey((value) => value + 1)
  }

  function handleClearFilters() {
    setPeriodStart('')
    setPeriodEnd('')
    setFilterError('')
    setAppliedFilters({
      period_start: '',
      period_end: '',
    })
    setReloadKey((value) => value + 1)
  }

  return (
    <section className="content-card report-page">
      <div className="section-heading">
        <div>
          <h1>Indicadores de incidencias</h1>

          <p className="page-description">
            Consulta los resultados de resolución,
            recuperación y documentación técnica.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={isLoading}
          onClick={() => setReloadKey((value) => value + 1)}
        >
          Actualizar resultados
        </button>
      </div>

      <form
        className="report-filters"
        onSubmit={handleApplyFilters}
        aria-describedby={
          filterError
            ? `${filterHelpId} ${filterErrorId}`
            : filterHelpId
        }
      >
        <fieldset disabled={isLoading}>
          <legend>Filtrar por fecha de recuperación</legend>

          <p id={filterHelpId} className="page-description">
            Las fechas corresponden a la hora de Perú.
            El día final se incluye completo.
            Deja los campos vacíos para consultar todo el período.
          </p>

          <div className="report-filter-fields">
            <div>
              <label htmlFor={startId}>Desde</label>
              <input
                id={startId}
                name="period_start"
                type="date"
                value={periodStart}
                onChange={(event) => {
                  setPeriodStart(event.target.value)
                  setFilterError('')
                }}
              />
            </div>

            <div>
              <label htmlFor={endId}>Hasta</label>
              <input
                id={endId}
                name="period_end"
                type="date"
                value={periodEnd}
                onChange={(event) => {
                  setPeriodEnd(event.target.value)
                  setFilterError('')
                }}
              />
            </div>
          </div>

          <div className="report-filter-actions">
            <button
              type="submit"
              className="primary-button"
            >
              Aplicar período
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={handleClearFilters}
            >
              Limpiar filtros
            </button>
          </div>
        </fieldset>

        {filterError && (
          <p
            id={filterErrorId}
            className="form-error"
            role="alert"
          >
            {filterError}
          </p>
        )}
      </form>

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">Calculando indicadores…</p>
        ) : errorMessage ? (
          <div>
            <p className="form-error" role="alert">
              {errorMessage}
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setReloadKey((value) => value + 1)
              }
            >
              Reintentar
            </button>
          </div>
        ) : report ? (
          <>
            <div className="report-summary">
              <p>
                <strong>Período aplicado:</strong>{' '}
                {describePeriod(
                  report.period_start,
                  report.period_end,
                )}
              </p>

              <p>
                <strong>Incidencias resueltas:</strong>{' '}
                {numberFormatter.format(
                  report.resolved_incidents,
                )}
              </p>
            </div>

            {report.resolved_incidents === 0 && (
              <p role="status">
                No hay incidencias resueltas en el período seleccionado.
              </p>
            )}

            <div className="report-indicators-grid">
              <IndicatorCard
                title="Tiempo promedio de resolución"
                value={report.resolution_time.average_minutes}
                unit="min"
                description={
                  'Desde el inicio de la primera solución hasta ' +
                  'la recuperación registrada. No utiliza la fecha de cierre.'
                }
                evaluated={
                  report.resolution_time.evaluated_incidents
                }
                excluded={
                  report.resolution_time.excluded_incidents
                }
              />

              <IndicatorCard
                title="Recuperación con la primera solución"
                value={
                  report.first_solution_recovery.percentage
                }
                unit="%"
                description={
                  'Casos recuperados mediante una única solución, ' +
                  'sin devolución ni necesidad de otra solución.'
                }
                evaluated={
                  report.first_solution_recovery.evaluated_incidents
                }
                excluded={
                  report.first_solution_recovery.excluded_incidents
                }
                matching={
                  report.first_solution_recovery.matching_incidents
                }
              />

              <IndicatorCard
                title="Documentación técnica completa"
                value={
                  report.complete_documentation.percentage
                }
                unit="%"
                description={
                  'La solución de recuperación contiene descripción, ' +
                  'acciones técnicas y evidencia.'
                }
                evaluated={
                  report.complete_documentation.evaluated_incidents
                }
                excluded={
                  report.complete_documentation.excluded_incidents
                }
                matching={
                  report.complete_documentation.matching_incidents
                }
              />
            </div>

            <aside className="report-explanation">
              <h2>Cómo interpretar los resultados</h2>

              <p>
                Cada porcentaje utiliza los casos evaluados
                de su indicador. Los casos sin trazabilidad
                suficiente quedan excluidos y se muestran por separado.
              </p>

              <p>
                “Sin datos evaluables” indica que no hay información
                suficiente para calcular el valor; no equivale a cero.
              </p>

              <p>
                Estos resultados corresponden a los registros
                del software. Durante la demostración reflejan
                pruebas simuladas y sus pausas; la base de preprueba
                de 100 incidencias se mantiene separada.
              </p>
            </aside>
          </>
        ) : null}
      </div>
    </section>
  )
}