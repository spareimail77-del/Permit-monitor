import ForgotPasswordForm from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main style={styles.main}>
      <div style={styles.center}>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100svh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  center: { width: "100%", maxWidth: 380, padding: "20px" },
};
