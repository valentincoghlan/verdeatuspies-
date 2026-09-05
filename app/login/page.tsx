import Image from "next/image";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="mb-6 text-center">
        <Image
          src="/logo.png"
          alt="Verde A Tus Pies"
          width={640}
          height={432}
          priority
          className="mx-auto mb-2 h-28 w-auto"
        />
        <h1 className="text-xl font-bold text-pasto-oscuro">Verde A Tus Pies</h1>
        <p className="mt-1 text-sm text-tinta-2">
          Entrá con tu mail y tu contraseña. Si todavía no tenés, pedí el link.
        </p>
      </div>
      <div className="card">
        <LoginForm />
      </div>
    </div>
  );
}
