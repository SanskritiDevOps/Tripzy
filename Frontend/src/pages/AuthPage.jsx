import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, Lock, Mail, User, Compass, Plane, Wallet } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { Card } from '../components/ui/Card'
import { useAuthStore } from '../store/useAuthStore'
import { toast } from '../store/useToastStore'
import { ApiError } from '../api/client'
import { loginPath, safeRedirect } from '../utils/urls'

// Mirrors the API rules (Backend/src/modules/auth/auth.schemas.js) for instant feedback.
const email = z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address'))

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
})

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
  email,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine((v) => new TextEncoder().encode(v).length <= 72, 'Password must be at most 72 bytes')
    .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use at least one letter and one number'),
})

// Created by `npm run db:seed` in Backend/ — only offered in development.
const DEMO_ACCOUNT = { email: 'demo@tripzy.app', password: 'tripzy-demo-123' }

export function AuthPage({ mode }) {
  const isSignup = mode === 'signup'
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const status = useAuthStore((s) => s.status)
  const bootError = useAuthStore((s) => s.bootError)
  const login = useAuthStore((s) => s.login)
  const registerAccount = useAuthStore((s) => s.register)
  const redirectParam = params.get('redirect')
  const redirectTo = safeRedirect(redirectParam)

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isSignup ? signupSchema : loginSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    clearErrors('root')
    try {
      const user = isSignup ? await registerAccount(values) : await login({ email: values.email, password: values.password })
      const firstName = user.name.split(' ')[0]
      toast.success(isSignup ? `Welcome to Tripzy, ${firstName}!` : `Welcome back, ${firstName}!`)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      if (!(error instanceof ApiError)) throw error
      // Field-level messages from the API (validation, "Email already in use").
      const fieldErrors = Object.entries(error.details ?? {}).filter(([field]) => ['name', 'email', 'password'].includes(field))
      fieldErrors.forEach(([field, message]) => setError(field, { message }, { shouldFocus: true }))
      if (fieldErrors.length === 0 || error.status !== 400) setError('root', { message: error.message })
      if (error.isNetworkError || error.status === 429 || error.status >= 500) toast.error(error.message)
    }
  })

  if (status === 'authenticated') return <Navigate to={redirectTo} replace />

  function fillDemo() {
    setValue('email', DEMO_ACCOUNT.email, { shouldValidate: true })
    setValue('password', DEMO_ACCOUNT.password, { shouldValidate: true })
  }

  const otherPage = loginPath(redirectParam, isSignup ? '/login' : '/signup')

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div className="hidden lg:block">
        <h1 className="font-display text-4xl leading-tight font-semibold">
          {isSignup ? 'Your crew’s next adventure starts here.' : 'Pick up where your group left off.'}
        </h1>
        <ul className="mt-8 space-y-5">
          {[
            { icon: Compass, title: 'Collect ideas together', body: 'Everyone adds places and votes on favourites.' },
            { icon: Plane, title: 'Build the plan live', body: 'Drag stops into days and watch changes sync.' },
            { icon: Wallet, title: 'Keep money friendly', body: 'Split costs and settle with the fewest payments.' },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-ocean-700 shadow-soft ring-1 ring-sand-200">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-slate-900">{title}</p>
                <p className="text-sm text-slate-600">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Card className="mx-auto w-full max-w-md p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold">{isSignup ? 'Create your account' : 'Log in to Tripzy'}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {isSignup ? 'Already have an account? ' : 'New here? '}
          <Link to={otherPage} className="font-semibold text-ocean-700 hover:underline">
            {isSignup ? 'Log in' : 'Create an account'}
          </Link>
        </p>

        {redirectParam && !errors.root && (
          <p className="mt-4 rounded-xl bg-sand-100 px-3.5 py-2.5 text-sm text-slate-700">
            {isSignup ? 'Create an account' : 'Log in'} to start planning — we’ll take you right back.
          </p>
        )}

        {(errors.root || bootError) && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 ring-1 ring-red-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {errors.root?.message ?? bootError}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {isSignup && (
            <Field label="Full name" error={errors.name?.message}>
              {({ id, invalid }) => <Input id={id} icon={User} autoComplete="name" placeholder="Aman Verma" invalid={invalid} {...register('name')} />}
            </Field>
          )}
          <Field label="Email" error={errors.email?.message}>
            {({ id, invalid }) => (
              <Input id={id} type="email" icon={Mail} autoComplete="email" placeholder="you@example.com" invalid={invalid} {...register('email')} />
            )}
          </Field>
          <Field label="Password" error={errors.password?.message} hint={isSignup ? '8+ characters with a letter and a number' : undefined}>
            {({ id, invalid }) => (
              <Input
                id={id}
                type="password"
                icon={Lock}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
                invalid={invalid}
                {...register('password')}
              />
            )}
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={isSubmitting} iconRight={isSubmitting ? undefined : ArrowRight}>
            {isSignup ? 'Create account' : 'Log in'}
          </Button>
        </form>

        {!isSignup && import.meta.env.DEV && (
          <div className="mt-5 rounded-2xl bg-ocean-50 p-4 text-sm text-ocean-900 ring-1 ring-ocean-100">
            <p className="font-semibold">Exploring the demo?</p>
            <p className="mt-0.5 text-ocean-800">
              Use the seeded demo account (run <code className="rounded bg-white px-1">npm run db:seed</code> in Backend first).
            </p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={fillDemo}>
              Use demo account
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
