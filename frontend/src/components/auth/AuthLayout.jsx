import { Link } from 'react-router-dom';

const AuthLayout = ({ title, description, children, width = 'regular' }) => (
  <main className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/70 via-slate-50 to-slate-100 px-4 py-8 sm:px-6 sm:py-10">
    <div className={`mx-auto w-full ${width === 'wide' ? 'max-w-4xl' : 'max-w-md'}`}>
      <header className="mb-5 text-center sm:mb-6">
        <Link to="/" className="mb-4 inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100" aria-label="RecruiHub - Trang chủ">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-lg font-bold text-white shadow-sm" aria-hidden="true">R</span>
          <span className="text-xl font-bold tracking-tight text-[#152348]">RecruiHub</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-[#152348] sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-1.5 max-w-lg text-sm leading-6 text-slate-600">{description}</p>
      </header>
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_16px_48px_rgba(15,23,42,0.08)] sm:p-7">
        {children}
      </section>
    </div>
  </main>
);

export default AuthLayout;
