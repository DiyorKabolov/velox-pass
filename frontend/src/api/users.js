import client from './client'

/** Replaces the signed-in user's avatar; resolves to the updated user. */
export async function uploadAvatar(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post('/users/me/avatar', form)
  return data
}

export async function deleteAvatar() {
  const { data } = await client.delete('/users/me/avatar')
  return data
}
