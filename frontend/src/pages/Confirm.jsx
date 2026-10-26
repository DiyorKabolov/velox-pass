import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { resendCode, verifyEmail } from '../api/auth'
import { apiError } from '../api/client'
import useAuth from '../hooks/useAuth'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import AuthLayout from '../components/layout/AuthLayout'

const LENGTH = 6

export default function Confirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuth } = useAuth()

  const [email, setEmail] = useState(location.state?.email ?? '')
  const [digits, setDigits] = useState(Array(LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const inputsRef = useRef([])
  // The code now goes off by itself on the sixth digit; this keeps a click on
  // the button during that request from sending it a second time.
  const sending = useRef(false)

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const submitCode = async (code) => {
    if (sending.current) return
    if (!email) {
      toast.error('Укажите email, на который регистрировались')
      return
    }
    sending.current = true
    setLoading(true)
    try {
      const data = await verifyEmail(email, code)
      setAuth(data.user, data.access_token)
      toast.success('Email подтверждён')
      navigate('/')
    } catch (error) {
      toast.error(apiError(error, 'Неверный код подтверждения'))
      setDigits(Array(LENGTH).fill(''))
      inputsRef.current[0]?.focus()
    } finally {
      sending.current = false
      setLoading(false)
    }
  }

  const handleDigit = (index, rawValue) => {
    const value = rawValue.replace(/\D/g, '')
    if (!value) {
      setDigits((prev) => prev.map((d, i) => (i === index ? '' : d)))
      return
    }

    // Typing or pasting several digits at once fills the boxes to the right.
    const next = [...digits]
    value.split('').forEach((char, offset) => {
      if (index + offset < LENGTH) next[index + offset] = char
    })
    setDigits(next)

    const focusAt = Math.min(index + value.length, LENGTH - 1)
    inputsRef.current[focusAt]?.focus()

    // An empty box makes the string shorter, so full length means every box
    // is filled. (`includes('')` is true of every string -- the old check
    // here could never pass, and the code was never sent on its own.)
    const joined = next.join('')
    if (joined.length === LENGTH) {
      submitCode(joined)
    }
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handleResend = async () => {
    if (!email) {
      toast.error('Сначала укажите email')
      return
    }
    try {
      await resendCode(email)
      toast.success('Новый код отправлен')
    } catch (error) {
      toast.error(apiError(error, 'Не удалось отправить код повторно'))
    }
  }

  return (
    <AuthLayout
      title="Подтверждение"
      lead={`Введите ${LENGTH}-значный код из письма.`}
      footer={
        <button
          type="button"
          onClick={handleResend}
          className="t-link text-[var(--muted)] hover:text-[var(--text)]"
        >
          Не пришло письмо? Отправить повторно
        </button>
      }
    >
      <div className="mb-6">
        <Input
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>

      <span className="t-label mb-2 block">Код из письма</span>
      <div className="mb-7 grid grid-cols-6 gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputsRef.current[index] = element
            }}
            value={digit}
            onChange={(event) => handleDigit(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            inputMode="numeric"
            maxLength={LENGTH}
            aria-label={`Цифра ${index + 1}`}
            className="t-poster t-num h-16 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-center text-[34px] text-[var(--text)] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)]"
          />
        ))}
      </div>

      <Button
        onClick={() => submitCode(digits.join(''))}
        loading={loading}
        disabled={digits.join('').length !== LENGTH}
        className="w-full"
        size="lg"
      >
        Подтвердить
      </Button>
    </AuthLayout>
  )
}
