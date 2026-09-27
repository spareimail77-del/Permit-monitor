import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main style={styles.main}>
      <div style={styles.center}>
        <LoginForm />
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
