/** @flowcode-library auth-sign-up · Sign up (Sign-in and sign-up)
 * Catalog ID: p.auth-form.sign-up (pattern)
 * Function: Sign up (p.auth-form.sign-up): the create-account screen with live password rules and a check-your-email confirmation.
 * Use it as: A ready-to-place p.auth-form.sign-up: copy auth-sign-up.tsx and replace SAMPLE (FlowCode brings the implementation file auth-sign-in.tsx with it).
 * Built from: p.auth-form.sign-up
 * Look: A centered card with name, email and a password field showing a strength meter and rule checklist, a terms checkbox and a create-account button.
 * Use cases: sign up; registration; create account; join form; member registration; onboarding start; account creation; new user signup
 * Jobs to be done: create an account for myself; join the service with my email; set a strong password; get started with a new account
 * Keywords: auth, sign up, register, form, password strength
 */
/**
 * Sign up: p.auth-form.sign-up, a create-account form with name, email and a password that shows its strength and a
 * live checklist of the rules, plus a terms checkbox. The implementation is AuthForm in auth-sign-in.tsx; this file
 * only fills in the content. Nothing is sent: the account is kept in local storage. Make it the app's own: replace
 * SAMPLE with the app's name, rules and terms link, and swap the storage for its real sign-up call.
 */
import { AuthForm } from "./auth-sign-in";

// flowcode:sample
const SAMPLE = {
  brand: "Kiln & Co. Studio",
  title: "Create your account",
  lede: "Book classes, keep track of your kiln firings and get reminders before each session.",
  takenEmails: ["sam@example.com"],
  rules: [
    { id: "length" as const, label: "At least 10 characters" },
    { id: "number" as const, label: "A number" },
    { id: "case" as const, label: "Upper and lower case" },
    { id: "symbol" as const, label: "A symbol, like ! or #" },
  ],
  strengthLabels: ["Too weak", "Weak", "Fair", "Good", "Strong"],
  termsHref: "#terms",
  privacyHref: "#privacy",
  termsLabel: "studio terms",
  privacyLabel: "privacy notice",
  storageKey: "studio-accounts",
  footer: { text: "Already have an account?", linkLabel: "Sign in", href: "#sign-in" },
  doneTitle: "Welcome, {name}",
  doneText: "Open it to turn on booking reminders.",
};

export default function AuthSignUp() {
  return <AuthForm variant="sign-up" {...SAMPLE} />;
}
