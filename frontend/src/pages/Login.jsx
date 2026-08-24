import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { login as loginRequest } from '../api/auth'
import { apiError } from '../api/client'
import useAuth from '../hooks/useAuth'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const [form, setForm] = useState({ login: '', password: '' })
  const [loading, setLoading] = useState(false)

  const update = (event) =>
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      const data = await loginRequest(form.login, form.password)
      setAuth(data.user, data.access_token)
      toast.success(`Welcome back, ${data.user.username}`)
      navigate('/')
    } catch (error) {
      const message = apiError(error, 'Could not sign in')
      toast.error(message)
      // An unconfirmed account should land on the code screen, not stay stuck.
      if (message.toLowerCase().includes('not confirmed')) {
        navigate('/confirm', { state: { email: form.login } })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-108px)] items-center justify-center px-5 py-14">
      <div className="w-full max-w-sm rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-8">
        <div className="mb-7 text-center">
          <p className="font-display text-[11px] tracking-[0.18em] text-[var(--accent)]">
            VELOX·PASS
          </p>
          <h1 className="mt-3 font-display text-xl">Sign in</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username or email"
            name="login"
            autoComplete="username"
            placeholder="admin@veloxpass.com"
            value={form.login}
            onChange={update}
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={update}
            required
          />
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          No account yet?{' '}
          <Link to="/register" className="text-[var(--accent)] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
