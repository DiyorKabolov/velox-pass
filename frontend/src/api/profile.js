import client from './client'

export { deleteAvatar, uploadAvatar } from './users'

/** Change the username. Resolves to the updated user. */
export async function updateProfile(data) {
  const { data: user } = await client.patch('/auth/profile', data)
  return user
}

/** { current_password, new_password } */
export async function changePassword(data) {
  const { data: result } = await client.patch('/auth/password', data)
  return result
}
