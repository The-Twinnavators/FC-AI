/** @flowcode-library auth-icon-reveal · Sign in (icon reveal) (Sign-in and sign-up)
 * Catalog ID: p.auth-form.icon-reveal (pattern)
 * Function: Sign in (p.auth-form.icon-reveal): the sign-in screen whose password shows and hides with an eye icon alone.
 * Use it as: A ready-to-place p.auth-form.icon-reveal: copy auth-icon-reveal.tsx and replace SAMPLE (FlowCode brings the implementation file auth-sign-in.tsx with it); on any AuthForm it is reveal="icon".
 * Built from: p.auth-form.sign-in
 * Look: The sign-in card with an eye icon alone at the right of the password field instead of the words Show and Hide.
 * Tokens: --color-text-muted --color-accent --control-sm --radius-sm --space-3 --focus-ring
 * Use cases: login page; sign in; member login; compact forms; mobile sign in
 * Jobs to be done: sign in to my account; check the password i typed
 * Keywords: auth, sign in, password, show password, icon
 */
/**
 * Sign in with an icon-only password toggle: p.auth-form.icon-reveal, the sign-in screen whose password field shows
 * and hides with an eye icon alone instead of the words Show and Hide. The implementation is AuthForm in
 * auth-sign-in.tsx (reveal="icon", which sign-up takes too); this file only fills in the content. Nothing is sent.
 * Make it the app's own: replace SAMPLE with the app's name and links, and swap in its real sign-in call.
 */
import { AuthForm } from "./auth-sign-in";

// flowcode:sample
const SAMPLE = {
  brand: "Kiln & Co. Studio",
  title: "Welcome back",
  lede: "Sign in to see your classes and open-studio bookings.",
  forgotHref: "#forgot-password",
  footer: { text: "New to the studio?", linkLabel: "Create an account", href: "#sign-up" },
  doneTitle: "You're signed in",
  doneText: "Good to see you again.",
};

export default function AuthIconReveal() {
  return <AuthForm {...SAMPLE} variant="sign-in" reveal="icon" />;
}
