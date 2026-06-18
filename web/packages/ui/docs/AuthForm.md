---
category: Pages
---
# AuthForm
The sign-in / sign-up page — a two-column layout: email + OAuth (GitHub/Google) form on the left, a brand showcase panel ("See inside every circuit") on the right (hidden below `md`).

**When to use:** As the full auth screen. Auth runs through Supabase when configured (falls back to a local profile); all network calls fire only on submit, so it renders statically.

**Props:**
- `mode` — `"login" | "signup"` — toggles copy, the name field, and the footer link.

**Example:**
```tsx
import { AuthForm } from "@electrace/ui";

<AuthForm mode="signup" />
```
