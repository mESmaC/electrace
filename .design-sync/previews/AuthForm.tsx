import { AuthForm } from "@electrace/ui";

/** The full sign-up screen — email + GitHub/Google on the left, the brand showcase panel on the right.
 *  (Pass mode="login" for the "Welcome back" variant.) */
export const SignUp = () => (
  <div data-theme="mid" style={{ background: "var(--color-bg)" }}>
    <AuthForm mode="signup" />
  </div>
);
