import AuthShell from "../components/AuthShell";
import RegisterForm from "./RegisterForm";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <AuthShell>
      <RegisterForm />
    </AuthShell>
  );
}
