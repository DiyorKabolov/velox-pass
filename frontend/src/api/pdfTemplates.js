import client from './client'

export async function getTemplates() {
  const { data } = await client.get('/admin/pdf-templates')
  return data
}

export async function getTemplate(id) {
  const { data } = await client.get(`/admin/pdf-templates/${id}`)
  return data
}

export async function uploadTemplate(file, name) {
  const form = new FormData()
  form.append('file', file)
  form.append('name', name)
  // No explicit Content-Type: the browser has to add the multipart boundary,
  // and setting the header by hand strips it.
  const { data } = await client.post('/admin/pdf-templates/upload', form)
  return data
}

export async function updateTemplate(id, payload) {
  const { data } = await client.patch(`/admin/pdf-templates/${id}`, payload)
  return data
}

export async function deleteTemplate(id) {
  await client.delete(`/admin/pdf-templates/${id}`)
}

/**
 * The rendered first page as an object URL.
 *
 * Fetched as a blob rather than pointed at from <img src>, because the endpoint
 * is behind the admin token and a bare <img> sends no Authorization header.
 * The caller owns the URL and must revoke it.
 */
export async function getPreviewImage(id) {
  const { data } = await client.get(`/admin/pdf-templates/${id}/preview-image`, {
    responseType: 'blob',
  })
  return URL.createObjectURL(data)
}

export async function setEventTemplate(eventId, templateId) {
  const { data } = await client.patch(`/admin/events/${eventId}/template`, {
    template_id: templateId,
  })
  return data
}
