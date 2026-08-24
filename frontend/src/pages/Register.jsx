import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { register as registerRequest } from '../api/auth'
import { apiError } from '../api/client'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const update = (event) =>
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      await registerRequest(form.username, form.email, form.password)
      toast.success('Check your email for the confirmation code')
      navigate('/confirm', { state: { email: form.email } })
    } catch (error) {
      toast.error(apiError(error, 'Could not create the account'))
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
          <h1 className="mt-3 font-display text-xl">Create account</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            name="username"
            autoComplete="username"
            placeholder="yourname"
            minLength={3}
            value={form.username}
            onChange={update}
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={update}
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="at least 6 characters"
            minLength={6}
            value={form.password}
            onChange={update}
            required
          />
          <Button type="submit" loading={loading} className="w-full" size="lg">
            Sign up
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Already registered?{' '}
          <Link to="/login" className="text-[var(--accent)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
