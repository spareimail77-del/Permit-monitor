import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <main style={styles.main}>
      <div style={styles.center}>
        <SignupForm />
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
  center: { width: "100%", maxWidth: 400, padding: "20px" },
};
