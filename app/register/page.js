import RegisterForm from "./RegisterForm";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <main style={styles.main}>
      <div style={styles.center}>
        <RegisterForm />
      </div>
    </main>
  );
}

const styles = {
  main: { minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center" },
  center: { width: "100%", maxWidth: 380, padding: "20px" },
};
