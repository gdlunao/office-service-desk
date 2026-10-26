import type {
  KnowledgeArticle,
  KnowledgeArticleCreate,
  KnowledgeArticleDraftUpdate,
  KnowledgeArticleSummary,
} from '../types/knowledge.types'

export class KnowledgeApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'KnowledgeApiError'
    this.status = status
  }
}

function checkResponse(response: Response): void {
  if (response.ok) return

  const message =
    response.status === 401
      ? 'La sesión ha vencido. Ingresa nuevamente.'
      : response.status === 403
        ? 'No tienes permisos para consultar la base de conocimiento.'
        : response.status === 404
          ? 'El artículo no está disponible para tu cuenta.'
          : response.status === 422
            ? 'Revisa los filtros de búsqueda.'
            : 'No se pudo consultar la base de conocimiento.'

  throw new KnowledgeApiError(message, response.status)
}

export async function listPublishedArticles(
  accessToken: string,
  search: string,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<KnowledgeArticleSummary[]> {
  const params = new URLSearchParams({
    status: 'published',
    offset: String(offset),
    limit: String(limit),
  })

  const cleanSearch = search.trim()

  if (cleanSearch) {
    params.set('search', cleanSearch)
  }

  const response = await fetch(
    `/api/v1/knowledge/articles?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal,
    },
  )

  checkResponse(response)

  return (await response.json()) as KnowledgeArticleSummary[]
}

export async function getKnowledgeArticle(
  accessToken: string,
  articleId: number,
  signal: AbortSignal,
): Promise<KnowledgeArticle> {
  const response = await fetch(
    `/api/v1/knowledge/articles/${articleId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal,
    },
  )

  checkResponse(response)

  return (await response.json()) as KnowledgeArticle
}

export async function createKnowledgeDraft(
  accessToken: string,
  data: KnowledgeArticleCreate,
): Promise<KnowledgeArticle> {
  const response = await fetch('/api/v1/knowledge/articles', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    let message =
      response.status === 401
        ? 'La sesión ha vencido. Ingresa nuevamente.'
        : response.status === 403
          ? 'No tienes permisos para crear este borrador.'
          : response.status === 404
            ? 'La incidencia de origen no está disponible.'
            : response.status === 409
              ? 'La incidencia no permite crear un nuevo borrador.'
              : response.status === 422
                ? 'Revisa la incidencia de origen.'
                : 'No se pudo confirmar la creación. Revisa los artículos antes de reintentar.'

    if (response.status === 409) {
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
        // Conserva el mensaje general si no se recibe JSON válido.
      }
    }

    throw new KnowledgeApiError(message, response.status)
  }

  return (await response.json()) as KnowledgeArticle
}

export async function listKnowledgeDrafts(
  accessToken: string,
  search: string,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<KnowledgeArticleSummary[]> {
  const params = new URLSearchParams({
    status: 'draft',
    offset: String(offset),
    limit: String(limit),
  })

  const cleanSearch = search.trim()

  if (cleanSearch) {
    params.set('search', cleanSearch)
  }

  const response = await fetch(
    `/api/v1/knowledge/articles?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal,
    },
  )

  checkResponse(response)

  return (await response.json()) as KnowledgeArticleSummary[]
}

async function checkMutationResponse(
  response: Response,
): Promise<void> {
  if (response.ok) return

  let message =
    response.status === 401
      ? 'La sesión ha vencido. Ingresa nuevamente.'
      : response.status === 403
        ? 'No tienes permisos para realizar esta operación.'
        : response.status === 404
          ? 'El artículo no está disponible para tu cuenta.'
          : response.status === 409
            ? 'El estado del artículo no permite esta operación. Actualiza el detalle.'
            : response.status === 422
              ? 'Revisa los campos. El título debe tener de 5 a 200 caracteres y los demás textos de 10 a 10 000.'
              : 'No se pudo confirmar la operación. Actualiza el artículo antes de reintentar.'

  if (response.status === 409) {
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
      // Conserva el mensaje general.
    }
  }

  throw new KnowledgeApiError(message, response.status)
}

export async function updateKnowledgeDraft(
  accessToken: string,
  articleId: number,
  data: KnowledgeArticleDraftUpdate,
): Promise<KnowledgeArticle> {
  const response = await fetch(
    `/api/v1/knowledge/articles/${articleId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15_000),
    },
  )

  await checkMutationResponse(response)

  return (await response.json()) as KnowledgeArticle
}

export async function publishKnowledgeArticle(
  accessToken: string,
  articleId: number,
): Promise<KnowledgeArticle> {
  const response = await fetch(
    `/api/v1/knowledge/articles/${articleId}/publish`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(15_000),
    },
  )

  await checkMutationResponse(response)

  return (await response.json()) as KnowledgeArticle
}