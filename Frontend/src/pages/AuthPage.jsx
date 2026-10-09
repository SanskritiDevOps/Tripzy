import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Lock, Mail, User, Compass, Plane, Wallet } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { Card } from '../components/ui/Card'
import { useTripzyStore } from '../store/useTripzyStore'
import { toast } from '../store/useToastStore'

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const signupSchema = loginSchema.extend({
  name: z.string().trim().min(2, 'Tell us your name'),
})

export function AuthPage({ mode }) {
  const isSignup = mode === 'signup'
  const navigate = useNavigate()
  const location = useLocation()
  const login = useTripzyStore((s) => s.login)
  const signup = useTripzyStore((s) => s.signup)
  const redirectTo = location.state?.from ?? '/trips'

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isSignup ? signupSchema : loginSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    // Simulated network latency so loading states are visible.
    await new Promise((r) => setTimeout(r, 450))
    const result = isSignup ? signup(values) : login(values)
    if (result.error) {
      setError('email', { message: result.error })
      return
    }
    toast.success(isSignup ? `Welcome to Tripzy, ${result.user.name.split(' ')[0]}!` : `Welcome back, ${result.user.name.split(' ')[0]}!`)
    navigate(redirectTo, { replace: true })
  })

  function fillDemo() {
    setValue('email', 'demo@tripzy.app')
    setValue('password', 'demo1234')
  }

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
          <Link to={isSignup ? '/login' : '/signup'} state={location.state} className="font-semibold text-ocean-700 hover:underline">
            {isSignup ? 'Log in' : 'Create an account'}
          </Link>
        </p>

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
          <Field label="Password" error={errors.password?.message}>
            {({ id, invalid }) => (
              <Input
                id={id}
                type="password"
                icon={Lock}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder="At least 6 characters"
                invalid={invalid}
                {...register('password')}
              />
            )}
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={isSubmitting} iconRight={isSubmitting ? undefined : ArrowRight}>
            {isSignup ? 'Create account' : 'Log in'}
          </Button>
        </form>

        {!isSignup && (
          <div className="mt-5 rounded-2xl bg-ocean-50 p-4 text-sm text-ocean-900 ring-1 ring-ocean-100">
            <p className="font-semibold">Exploring the demo?</p>
            <p className="mt-0.5 text-ocean-800">Log in as the demo traveller to see trips with places, votes and expenses.</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={fillDemo}>
              Use demo account
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
