import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";
import { ResendOTPEmailVerification } from "./ResendOTPEmailVerification";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: ResendOTPPasswordReset,
      verify: ResendOTPEmailVerification,
      profile(params) {
        return {
          email: params.email as string,
          name:
            typeof params.name === "string" && params.name.trim().length > 0
              ? params.name.trim()
              : (params.email as string),
        };
      },
    }),
  ],
});
