import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { register as registerRequest } from '../api/auth'
import { apiError } from '../api/client'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import AuthLayout from '../components/layout/AuthLayout'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const update = (event) =>
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (form.password.length < 6) {
      toast.error('Пароль должен быть не короче 6 символов')
      return
    }

    setLoading(true)
    try {
      await registerRequest(form.username, form.email, form.password)
      toast.success('Код подтверждения отправлен на почту')
      navigate('/confirm', { state: { email: form.email } })
    } catch (error) {
      toast.error(apiError(error, 'Не удалось создать аккаунт'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Регистрация"
      lead="Аккаунт нужен, чтобы получать билеты с QR-кодом, хранить их в кабинете и дарить друзьям."
      footer={
        <>
          Уже есть аккаунт?{' '}
          <Link to="/login" className="t-link text-[var(--text)]">
            Войти
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Имя пользователя"
          name="username"
          autoComplete="username"
          placeholder="ваше имя"
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
          label="Пароль"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="минимум 6 символов"
          minLength={6}
          value={form.password}
          onChange={update}
          required
        />
        <Button type="submit" loading={loading} className="mt-2 w-full" size="lg">
          Создать аккаунт
        </Button>
      </form>
    </AuthLayout>
  )
}
