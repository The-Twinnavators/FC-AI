/** @flowcode-library auth-forgot-password · Forgot password (Sign-in and sign-up)
 * Catalog ID: p.auth-form.forgot-password (pattern)
 * Function: Forgot password (p.auth-form.forgot-password): request a reset link and resend it after a cooldown.
 * Use it as: A ready-to-place p.auth-form.forgot-password: copy auth-forgot-password.tsx and replace SAMPLE (FlowCode brings the implementation file auth-sign-in.tsx with it).
 * Built from: p.auth-form.forgot-password
 * Look: A centered card asking for an email, then a check-your-email screen with next steps, a resend button on a cooldown and a back link.
 * Use cases: forgot password; password reset; account recovery; reset link request; locked out; recover access
 * Jobs to be done: reset my forgotten password; get back into my account; receive a password reset link; resend the reset email
 * Keywords: auth, password reset, forgot password, email, cooldown
 */
/**
 * Forgot password: p.auth-form.forgot-password, ask for an email, then show a "check your email" screen with what to do
 * next and a resend button that waits out a short cooldown. The implementation is AuthForm in auth-sign-in.tsx; this
 * file only fills in the content. Use it as the route behind "Forgot password?". Nothing is sent: the "link" is only
 * pretended. Make it the app's own: replace SAMPLE with the app's copy and cooldown, and call its real reset endpoint.
 */
import { AuthForm } from "./auth-sign-in";

// flowcode:sample
const SAMPLE = {
  brand: "Kiln & Co. Studio",
  title: "Reset your password",
  lede: "Enter the email you signed up with and we'll send you a link to choose a new password.",
  cooldownSeconds: 30,
  linkValidMinutes: 30,
  footer: { text: "Remembered it?", linkLabel: "Back to sign in", href: "#sign-in" },
  help: { label: "Get help", href: "#help" },
};

export default function AuthForgotPassword() {
  return <AuthForm variant="forgot-password" {...SAMPLE} />;
}
