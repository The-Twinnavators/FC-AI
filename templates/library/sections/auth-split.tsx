/** @flowcode-library auth-split · Sign in, split (Sign-in and sign-up)
 * Catalog ID: p.auth-form.sign-in (pattern)
 * Function: Sign in, split (p.auth-form.sign-in with layout split): the sign-in form beside a quote panel; pass layout="split" and a side panel to AuthForm.
 * Use it as: A ready-to-place p.auth-form.sign-in (layout split): copy auth-split.tsx and replace SAMPLE (FlowCode brings the implementation file auth-sign-in.tsx with it).
 * Built from: p.auth-form.sign-in
 * Look: The sign-in form on one side and a soft accent-gradient panel with a member quote on the other; the panel becomes a banner on phones.
 * Use cases: sign in; login; member login; customer portal login; branded login; account access; returning user login
 * Jobs to be done: sign in to my account; get back to my saved work; access my member area; log in with my email and password
 * Keywords: auth, sign in, login, split, quote
 */
/**
 * Sign in, split: p.auth-form.sign-in with layout="split", the sign-in form beside a picture panel drawn from the
 * theme's accent (a soft gradient with a short quote from a member). On phones the picture becomes a short banner
 * above the form. The implementation is AuthForm in auth-sign-in.tsx; this file only fills in the content. Use it when
 * the sign-in page should also sell the place a little. Nothing is sent: the sample account in SAMPLE is checked in
 * memory. Make it the app's own: replace SAMPLE with the app's copy and a real member quote, and swap the check for
 * its sign-in call.
 */
import { AuthForm } from "./auth-sign-in";

// flowcode:sample
const SAMPLE = {
  brand: "Kiln & Co. Studio",
  title: "Sign in to your studio",
  lede: "Your classes, shelf space and firing queue in one place.",
  demo: { email: "sam@example.com", password: "glaze-2024" },
  forgotHref: "#forgot-password",
  footer: { text: "No account yet?", linkLabel: "Join the studio", href: "#sign-up" },
  doneTitle: "Signed in",
  doneText: "Welcome back. Your next class is on the timetable.",
  side: {
    tag: "Open studio · Tue to Sun",
    quote: "I booked one Saturday taster and somehow I now have a shelf, a favorite wheel and twelve slightly wonky mugs.",
    person: { initials: "RO", name: "Rosa Okafor", role: "Member since spring" },
  },
};

export default function AuthSplit() {
  return <AuthForm variant="sign-in" layout="split" {...SAMPLE} />;
}
