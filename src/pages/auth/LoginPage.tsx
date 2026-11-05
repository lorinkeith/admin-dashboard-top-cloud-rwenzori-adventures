import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiEye, FiEyeOff, FiLock, FiMail } from 'react-icons/fi'
import { hasSupabaseConfig, supabase } from '../../lib/supabaseClient'

const SUPABASE_CONNECTION_ERROR =
  'Unable to connect to Supabase. Please check your Supabase URL, publishable key, and internet connection.'

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!supabase) {
      setError(SUPABASE_CONNECTION_ERROR)
      return
    }

    setIsLoading(true)
    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

      if (signInError) {
        setError(
          signInError.message === 'Failed to fetch'
            ? SUPABASE_CONNECTION_ERROR
            : signInError.message,
        )
        return
      }

      if (!data.session) {
        setError('Login did not return a Supabase session. Please try again.')
        return
      }

      const access = await supabase.rpc('is_admin')
      if (access.error || access.data !== true) {
        await supabase.auth.signOut()
        setError('This account is not an authorized administrator.')
        return
      }
      navigate('/dashboard', { replace: true })
    } catch (signInError) {
      const message =
        signInError instanceof Error ? signInError.message : String(signInError)

      setError(
        message === 'Failed to fetch'
          ? SUPABASE_CONNECTION_ERROR
          : message || SUPABASE_CONNECTION_ERROR,
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-admin-dark px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-white p-6 shadow-soft sm:p-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-admin-accent">
            Private CMS
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-admin-dark">
            Top Cloud Rwenzori Adventures Admin
          </h1>
          <p className="mt-2 text-sm leading-6 text-admin-muted">
            Sign in with your administrator account to manage tour content.
          </p>
        </div>

        {!hasSupabaseConfig ? (
          <div className="mb-5 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
            Add Supabase values to a local .env file before logging in.
          </div>
        ) : null}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-admin-dark">Email</span>
            <span className="mt-2 flex items-center gap-3 rounded-lg border border-admin-border bg-white px-3 py-2.5 focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-brand-100">
              <FiMail className="h-5 w-5 text-admin-muted" aria-hidden="true" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border-0 bg-transparent text-sm text-admin-dark outline-none placeholder:text-slate-400"
                placeholder="admin@example.com"
                autoComplete="email"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-admin-dark">
              Password
            </span>
            <span className="mt-2 flex items-center gap-3 rounded-lg border border-admin-border bg-white px-3 py-2.5 focus-within:border-admin-accent focus-within:ring-2 focus-within:ring-brand-100">
              <FiLock className="h-5 w-5 text-admin-muted" aria-hidden="true" />
              <input
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border-0 bg-transparent text-sm text-admin-dark outline-none placeholder:text-slate-400"
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-admin-muted transition hover:bg-brand-50 hover:text-admin-accent focus:outline-none focus:ring-2 focus:ring-brand-100"
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              >
                {isPasswordVisible ? (
                  <FiEyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <FiEye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </span>
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-admin-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default LoginPage
