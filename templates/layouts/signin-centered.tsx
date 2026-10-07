/**
 * Layout: Sign in, "centred" version. One small card with sign in and create account, password show/hide and
 * helpful errors. Good for most apps with accounts.
 *
 * To make it this app's own:
 *  1. Replace every value in SAMPLE with the spec's product name and wording, and connect submit to the app's real
 *     account logic (never store passwords in plain text or local storage). Remove the "flowcode:sample" comment when
 *     nothing sample is left.
 *  2. Delete what the spec doesn't need (for example "Create account").
 *  3. Keep the building blocks and tokens. Change spacing or colours in src/styles/tokens.css, not here.
 */
import { useState, type FormEvent } from "react";
import { Button, Card, Field, Notice, Tabs } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  product: "Your app",
  signIn: { title: "Sign in", button: "Sign in" },
  signUp: { title: "Create account", button: "Create account", rules: "At least 8 characters, with a number." },
  error: "That email and password don't match. Check them and try again, or reset your password.",
};

export default function SignInScreen({ onSignedIn }: { onSignedIn?: () => void }) {
  const data = SAMPLE;
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setError("Enter your email and password.");
    if (mode === "signup" && !/^(?=.*\d).{8,}$/.test(password)) return setError(data.signUp.rules);
    setError("");
    onSignedIn?.();
  };
  return (
    <div className="ui-narrow">
      <Card>
        <span className="ui-hero__eyebrow">{data.product}</span>
        <Tabs label="Account" tabs={[{ id: "signin", label: data.signIn.title }, { id: "signup", label: data.signUp.title }]} current={mode} onChange={(m) => (setMode(m), setError(""))}>
          <form className="ui-grid" onSubmit={submit} noValidate>
            <h1 className="ui-section__title">{mode === "signin" ? data.signIn.title : data.signUp.title}</h1>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Field label="Email" required>
              {(p) => <input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            <Field label="Password" required hint={mode === "signup" ? data.signUp.rules : undefined}>
              {(p) => <input {...p} type={show ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />}
            </Field>
            <Button variant="ghost" size="sm" onClick={() => setShow((s) => !s)} aria-pressed={show}>
              {show ? "Hide password" : "Show password"}
            </Button>
            <Button variant="primary" type="submit">
              {mode === "signin" ? data.signIn.button : data.signUp.button}
            </Button>
          </form>
        </Tabs>
      </Card>
    </div>
  );
}
