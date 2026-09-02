import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-hoja-600 text-lg font-bold text-white">
          V
        </div>
        <h1 className="text-xl font-bold">Verde A Tus Pies</h1>
        <p className="mt-1 text-sm text-tierra-600">
          Entrá con tu mail. Te mandamos un link, sin contraseñas.
        </p>
      </div>
      <div className="card">
        <LoginForm />
      </div>
    </div>
  );
}
