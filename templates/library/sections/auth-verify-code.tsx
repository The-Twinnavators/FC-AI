/** @flowcode-library auth-verify-code · Verify code (Sign-in and sign-up)
 * Catalog ID: p.auth-form.verify-code (pattern)
 * Function: Verify code (p.auth-form.verify-code): six-digit code entry with paste, auto-advance, wrong-code feedback and resend.
 * Use it as: A ready-to-place p.auth-form.verify-code: copy auth-verify-code.tsx and replace SAMPLE (FlowCode brings the implementation file auth-sign-in.tsx with it).
 * Built from: p.auth-form.verify-code
 * Look: A centered card with six one-time-code boxes split by a small dash, a verify button, a resend countdown and a back link.
 * Use cases: email verification; phone verification; two-factor authentication; one-time code; otp entry; login verification; confirm sign up; magic code login
 * Jobs to be done: confirm my email address; verify my phone number; prove it is really me; finish signing in securely; get a new code sent
 * Keywords: auth, otp, verification, two-step, code input
 */
/**
 * Verify code: p.auth-form.verify-code, a six-digit one-time code in six boxes. Typing moves to the next box, pasting
 * fills them all, Backspace on an empty box moves back and the arrow keys move between boxes. A wrong code shakes and
 * explains; the right code shows a confirmation. Includes a resend link with a cooldown. The implementation is
 * AuthForm in auth-sign-in.tsx; this file only fills in the content. Use it after sign-up, for two-step sign-in or to
 * confirm a phone number. Nothing is sent: the sample code in SAMPLE is checked in memory. Make it the app's own:
 * replace SAMPLE with the app's copy and swap the check for its real verify call.
 */
import { AuthForm } from "./auth-sign-in";

// flowcode:sample
const SAMPLE = {
  title: "Enter your code",
  lede: "We sent a 6-digit code to",
  destination: "sam@example.com",
  demoCode: "482913",
  length: 6,
  resendSeconds: 20,
  attemptsAllowed: 5,
  expiresMinutes: 10,
  footer: { linkLabel: "Back to sign in", href: "#sign-in" },
};

export default function AuthVerifyCode() {
  return <AuthForm variant="verify-code" {...SAMPLE} />;
}
