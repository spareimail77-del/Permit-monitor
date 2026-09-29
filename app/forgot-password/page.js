import AuthShell from "../components/AuthShell";
import ForgotForm from "./ForgotForm";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotForm />
    </AuthShell>
  );
}
