import client from './client'

export async function login(loginValue, password) {
  const { data } = await client.post('/auth/login', {
    login: loginValue,
    password,
  })
  return data
}

export async function register(username, email, password) {
  const { data } = await client.post('/auth/register', {
    username,
    email,
    password,
  })
  return data
}

export async function verifyEmail(email, code) {
  const { data } = await client.post('/auth/verify', { email, code })
  return data
}

export async function resendCode(email) {
  const { data } = await client.post('/auth/resend', null, { params: { email } })
  return data
}

export async function getMe() {
  const { data } = await client.get('/auth/me')
  return data
}
