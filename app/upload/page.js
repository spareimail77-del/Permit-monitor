import { cookies } from "next/headers";
import Header from "../components/Header";
import PasscodeGate from "./PasscodeGate";
import UploadForm from "./UploadForm";
import { SESSION_COOKIE, verifySessionToken } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const authed = verifySessionToken(token);

  return (
    <main style={styles.main}>
      <Header />
      <section style={styles.body}>
        {authed ? <UploadForm /> : <PasscodeGate />}
      </section>
    </main>
  );
}

const styles = {
  main: { minHeight: "100dvh" },
  body: { maxWidth: 720, margin: "0 auto", padding: "32px 20px" },
};
