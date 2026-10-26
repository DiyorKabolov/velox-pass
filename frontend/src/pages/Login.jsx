import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { login as loginRequest } from '../api/auth'
import { apiError } from '../api/client'
import useAuth from '../hooks/useAuth'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import AuthLayout from '../components/layout/AuthLayout'
import { returnPath } from '../utils/returnPath'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuth } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const update = (event) =>
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      const data = await loginRequest(form.email, form.password)
      setAuth(data.user, data.access_token)
      toast.success(`С возвращением, ${data.user.username}`)
      // Back to the page that asked for the login -- the event whose ticket
      // was wanted, the cabinet tab -- and not to the start.
      navigate(returnPath(location), { replace: true })
    } catch (error) {
      const message = apiError(error, 'Не удалось войти')
      toast.error(message)
      // An unconfirmed account should land on the code screen, not stay stuck.
      if (message.toLowerCase().includes('не подтверждён')) {
        navigate('/confirm', { state: { email: form.email } })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="С возвращением"
      lead="Войдите, чтобы увидеть свои билеты, выбрать места на схеме зала и подарить билет другу."
      footer={
        <>
          Нет аккаунта?{' '}
          <Link to="/register" className="t-link text-[var(--text)]">
            Зарегистрироваться
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email или имя пользователя"
          name="email"
          autoComplete="username"
          placeholder="admin@veloxpass.com"
          value={form.email}
          onChange={update}
          required
        />
        <Input
          label="Пароль"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={form.password}
          onChange={update}
          required
        />
        <Button type="submit" loading={loading} className="mt-2 w-full" size="lg">
          Войти
        </Button>
      </form>
    </AuthLayout>
  )
}
