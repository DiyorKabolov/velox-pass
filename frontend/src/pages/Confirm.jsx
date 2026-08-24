import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { resendCode, verifyEmail } from '../api/auth'
import { apiError } from '../api/client'
import useAuth from '../hooks/useAuth'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const LENGTH = 6

export default function Confirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuth } = useAuth()

  const [email, setEmail] = useState(location.state?.email ?? '')
  const [digits, setDigits] = useState(Array(LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const inputsRef = useRef([])

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const submitCode = async (code) => {
    if (!email) {
      toast.error('Enter the email you registered with')
      return
    }
    setLoading(true)
    try {
      const data = await verifyEmail(email, code)
      setAuth(data.user, data.access_token)
      toast.success('Email confirmed')
      navigate('/')
    } catch (error) {
      toast.error(apiError(error, 'Invalid confirmation code'))
      setDigits(Array(LENGTH).fill(''))
      inputsRef.current[0]?.focus()
    } finally {
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

    const joined = next.join('')
    if (joined.length === LENGTH && !joined.includes('')) {
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
      toast.error('Enter your email first')
      return
    }
    try {
      await resendCode(email)
      toast.success('A new code is on its way')
    } catch (error) {
      toast.error(apiError(error, 'Could not resend the code'))
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-108px)] items-center justify-center px-5 py-14">
      <div className="w-full max-w-sm rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-8">
        <div className="mb-7 text-center">
          <p className="font-display text-[11px] tracking-[0.18em] text-[var(--accent)]">
            VELOX·PASS
          </p>
          <h1 className="mt-3 font-display text-xl">Confirm your email</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Enter the {LENGTH}-digit code we sent you.
          </p>
        </div>

        <div className="mb-5">
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

        <div className="mb-6 flex justify-between gap-2">
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
              aria-label={`Digit ${index + 1}`}
              className="h-13 w-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] py-3 text-center font-mono2 text-lg text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
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
          Confirm
        </Button>

        <button
          type="button"
          onClick={handleResend}
          className="mt-5 w-full text-center text-sm text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
        >
          Resend the code
        </button>
      </div>
    </div>
  )
}
