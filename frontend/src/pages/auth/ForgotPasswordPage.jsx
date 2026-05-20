import { useState } from "react";
import { Link } from "react-router";
import { api } from "../../api/client.js";
import { Button, Input } from "../../components/Ui.jsx";
import AuthShell from "./AuthShell.jsx";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [devLink, setDevLink] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setDevLink("");
    setError("");
    try {
      const data = await api.post("/auth/forget-password", { email });
      setMessage(data.message || "Da gui link dat lai mat khau.");
      if (data.resetUrl) {
        setDevLink(data.resetUrl);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Quen mat khau"
      subtitle="Nhap email de nhan link dat lai mat khau."
      footer={<Link className="font-semibold text-teal-700" to="/login">Quay lai dang nhap</Link>}
    >
      <form className="grid gap-4" onSubmit={submit}>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {message ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
        {devLink ? (
          <a className="break-all rounded-md bg-slate-50 p-3 text-sm font-semibold text-teal-700" href={devLink}>
            {devLink}
          </a>
        ) : null}
        {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        <Button disabled={submitting}>{submitting ? "Dang gui..." : "Gui link dat lai"}</Button>
      </form>
    </AuthShell>
  );
};

export default ForgotPasswordPage;
