import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'

import {
  KnowledgeApiError,
  listKnowledgeDrafts,
  listPublishedArticles,
} from '../api/knowledge.api'
import { KnowledgeArticleDetail } from '../components/KnowledgeArticleDetail'
import {
  KNOWLEDGE_STATUS_LABELS,
} from '../types/knowledge.types'
import type {
  KnowledgeArticleSummary,
} from '../types/knowledge.types'

interface KnowledgePageProps {
  accessToken: string
  onSessionExpired: () => void
  canPublish?: boolean
}

type KnowledgeView = 'published' | 'draft'

const PAGE_SIZE = 20

export function KnowledgePage({
  accessToken,
  canPublish = false,
  onSessionExpired,
}: KnowledgePageProps) {
  const searchId = useId()
  const viewId = useId()
  const detailPanelId = useId()

  const [view, setView] = useState<KnowledgeView>('published')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [articles, setArticles] =
    useState<KnowledgeArticleSummary[]>([])
  const [offset, setOffset] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedArticleId, setSelectedArticleId] =
    useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true
    let timedOut = false

    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 15_000)

    async function loadArticles() {
      setIsLoading(true)
      setErrorMessage('')
      setArticles([])

      try {
        const listArticles =
          view === 'draft'
            ? listKnowledgeDrafts
            : listPublishedArticles

        const result = await listArticles(
          accessToken,
          appliedSearch,
          offset,
          PAGE_SIZE,
          controller.signal,
        )

        if (isActive) {
          setArticles(result)
        }
      } catch (error: unknown) {
        if (!isActive) return

        if (
          error instanceof KnowledgeApiError &&
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
                : 'No se pudo cargar la base de conocimiento.',
        )
      } finally {
        window.clearTimeout(timeoutId)

        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadArticles()

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [
    accessToken,
    view,
    appliedSearch,
    offset,
    reloadKey,
    onSessionExpired,
  ])

  function handleViewChange(nextView: KnowledgeView) {
    setView(nextView)
    setSearchInput('')
    setAppliedSearch('')
    setOffset(0)
    setSelectedArticleId(null)
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setAppliedSearch(searchInput.trim())
    setOffset(0)
    setSelectedArticleId(null)
    setReloadKey((value) => value + 1)
  }

  function handleClearSearch() {
    setSearchInput('')
    setAppliedSearch('')
    setOffset(0)
    setSelectedArticleId(null)
    setReloadKey((value) => value + 1)
  }

  function handleRefresh() {
    setSelectedArticleId(null)
    setReloadKey((value) => value + 1)
  }

  function handlePreviousPage() {
    setSelectedArticleId(null)
    setOffset((value) => Math.max(0, value - PAGE_SIZE))
  }

  function handleNextPage() {
    setSelectedArticleId(null)
    setOffset((value) => value + PAGE_SIZE)
  }

  const isDraftView = view === 'draft'

  function handleArticleUpdated() {
    setOffset(0)
    setReloadKey((value) => value + 1)
  }

  return (
    <section className="content-card">
      <div className="section-heading">
        <div>
          <h1>Base de conocimiento</h1>
          <p className="page-description">
            Consulta soluciones publicadas y revisa los borradores
            disponibles para tu cuenta.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={isLoading}
          onClick={handleRefresh}
        >
          Actualizar
        </button>
      </div>

      <div>
        <label htmlFor={viewId}>Mostrar artículos</label>{' '}
        <select
          id={viewId}
          value={view}
          disabled={isLoading}
          onChange={(event) => {
            const nextView = event.target.value

            if (
              nextView === 'published' ||
              nextView === 'draft'
            ) {
              handleViewChange(nextView)
            }
          }}
        >
          <option value="published">Publicados</option>
          <option value="draft">Borradores</option>
        </select>
      </div>

      <p className="page-description">
        {isDraftView
          ? 'Los borradores están pendientes de revisión y publicación. Cada técnico consulta sus propios borradores; el responsable TI puede revisar todos.'
          : 'Los artículos publicados están disponibles para apoyar la atención técnica.'}
      </p>

      <form onSubmit={handleSearch}>
        <label htmlFor={searchId}>
          Buscar por título o descripción del problema
        </label>

        <div className="section-actions">
          <input
            id={searchId}
            type="search"
            value={searchInput}
            maxLength={200}
            placeholder="Por ejemplo: impresora"
            disabled={isLoading}
            onChange={(event) =>
              setSearchInput(event.target.value)
            }
          />

          <button
            type="submit"
            className="secondary-button"
            disabled={isLoading}
          >
            Buscar
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={isLoading}
            onClick={handleClearSearch}
          >
            Limpiar
          </button>
        </div>
      </form>

      <p className="page-description">
        {appliedSearch
          ? `Búsqueda aplicada: ${appliedSearch}`
          : isDraftView
            ? 'Mostrando borradores disponibles para tu cuenta.'
            : 'Mostrando artículos publicados.'}
      </p>

      <div aria-busy={isLoading}>
        {isLoading ? (
          <p role="status">Cargando artículos…</p>
        ) : errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : articles.length === 0 ? (
          <p role="status">
            {offset > 0
              ? 'No hay artículos en esta página.'
              : appliedSearch
                ? 'No se encontraron artículos para esa búsqueda.'
                : isDraftView
                  ? 'No hay borradores disponibles para tu cuenta.'
                  : 'Todavía no hay artículos publicados.'}
          </p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <caption>
                {isDraftView
                  ? 'Borradores de conocimiento'
                  : 'Artículos de conocimiento publicados'}
              </caption>

              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Título</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td>{article.id}</td>
                    <td>{article.title}</td>
                    <td>
                      {KNOWLEDGE_STATUS_LABELS[article.status] ??
                        'Estado desconocido'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        aria-label={`Ver artículo: ${article.title}`}
                        aria-expanded={
                          selectedArticleId === article.id
                        }
                        aria-controls={
                          selectedArticleId === article.id
                            ? detailPanelId
                            : undefined
                        }
                        onClick={() =>
                          setSelectedArticleId(article.id)
                        }
                      >
                        Ver artículo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="pagination">
        <button
          type="button"
          className="secondary-button"
          disabled={isLoading || offset === 0}
          onClick={handlePreviousPage}
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
            articles.length < PAGE_SIZE
          }
          onClick={handleNextPage}
        >
          Siguiente
        </button>
      </div>

      {selectedArticleId !== null && (
        <div id={detailPanelId}>
          <KnowledgeArticleDetail
            key={selectedArticleId}
            accessToken={accessToken}
            articleId={selectedArticleId}
            onClose={() => setSelectedArticleId(null)}
            onSessionExpired={onSessionExpired}
            canPublish={canPublish}
            onArticleUpdated={handleArticleUpdated}
          />
        </div>
      )}
    </section>
  )
}