// Browser-safe stand-in for @/lib/auth, aliased in tsup for the design-system bundle.
// The real module imports the Supabase browser client; AuthForm only calls these on submit (which a
// static preview never triggers), so stubbing them keeps Supabase out of the design bundle entirely.
type AuthResult = { error: string | null; session?: boolean };
export const supabaseConfigured = false;
export const supabaseBrowser = () => null;
export const emailSignUp = async (_name?: string, _email?: string, _password?: string): Promise<AuthResult> => ({ error: null, session: true });
export const emailSignIn = async (_email?: string, _password?: string): Promise<AuthResult> => ({ error: null });
export const oauthSignIn = async (_provider?: "github" | "google"): Promise<AuthResult> => ({ error: null });
export function useProfile() { return { mounted: true, profile: null as null | { name?: string; email?: string } }; }
export const signOut = async () => {};
