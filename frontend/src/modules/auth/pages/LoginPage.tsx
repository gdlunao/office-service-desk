import { LoginForm } from '../components/LoginForm'
import loginSupport from '../assets/login-support.png'
import type { CurrentUser } from '../types/auth.types'

import './LoginPage.css'

interface LoginPageProps {
  onLoginSuccess: (accessToken: string, user: CurrentUser) => void
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  return (
    <main className="auth-login-page">
      <div className="auth-login-shell">
        <section
          className="auth-login-intro"
          aria-labelledby="auth-login-intro-title"
        >
          <div className="auth-login-brand">
            <span className="auth-login-monogram" aria-hidden="true">
              SD
            </span>
            <span>OFFICE SERVICE DESK</span>
          </div>

          <div className="auth-login-welcome">
            <h2 id="auth-login-intro-title">
              Tu espacio de soporte TI
            </h2>
            <p>
              Reporta un problema y consulta cómo avanza su atención.
            </p>
          </div>

          <img
            className="auth-login-illustration"
            src={loginSupport}
            alt=""
            width={1536}
            height={1024}
          />

        </section>

        <section
          className="auth-login-access"
          aria-labelledby="auth-login-title"
        >
          <div className="auth-login-access-content">
            <p className="auth-login-eyebrow">SISTEMA DE INCIDENCIAS TI</p>
            <h1 id="auth-login-title">Bienvenido</h1>
            <p className="auth-login-description">
              Ingresa con tu cuenta para continuar.
            </p>

            <LoginForm onLoginSuccess={onLoginSuccess} />

            <p className="auth-login-help">
              ¿Necesitas una cuenta? Comunícate con el administrador.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
