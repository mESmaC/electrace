import { ColorTokens } from "@electrace/ui";

/** The Electrace color tokens — semantic surfaces/text/borders (theme-switchable) plus the
 *  theme-constant brand & status colors, each labeled with its Tailwind utility. */
export const Tokens = () => (
  <div data-theme="mid">
    <ColorTokens />
  </div>
);
