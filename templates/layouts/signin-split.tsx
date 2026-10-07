/**
 * Layout: Sign in, "split" version. What the product does on one side and the sign-in form on the other (stacked on
 * phones). Good when people may arrive without knowing the product.
 *
 * To make it this app's own:
 *  1. Replace every value in SAMPLE with the spec's product name, promise and wording, and connect submit to the
 *     app's real account logic (never store passwords in plain text or local storage). Remove the "flowcode:sample"
 *     comment when nothing sample is left.
 *  2. Delete what the spec doesn't need.
 *  3. Keep the building blocks and tokens. Change spacing or colours in src/styles/tokens.css, not here.
 */
import { useState, type FormEvent } from "react";
import { Button, Card, Checklist, Field, Grid, Hero, Notice } from "../components/ui";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Welcome back",
  title: "Pick up right where you left off",
  description: "Your plans, progress and notes, ready when you are.",
  points: ["Everything saved automatically", "Works on phone and computer", "Private to your account"],
  form: { title: "Sign in", button: "Sign in", forgot: "Forgot your password?" },
};

export default function SignInScreen({ onSignedIn, onNavigate }: { onSignedIn?: () => void; onNavigate?: (screen: string) => void }) {
  const data = SAMPLE;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setError("Enter your email and password.");
    setError("");
    onSignedIn?.();
  };
  return (
    <Grid kind="halves">
      <Hero eyebrow={data.eyebrow} title={data.title} description={data.description} actions={<Checklist label="Why sign in" items={data.points.map((p) => ({ id: p, title: p, done: true }))} />} />
      <Card title={data.form.title}>
        <form className="ui-grid" onSubmit={submit} noValidate>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Field label="Email" required>
            {(p) => <input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Password" required>
            {(p) => <input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button variant="primary" type="submit">
            {data.form.button}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onNavigate?.("forgot-password")}>
            {data.form.forgot}
          </Button>
        </form>
      </Card>
    </Grid>
  );
}
