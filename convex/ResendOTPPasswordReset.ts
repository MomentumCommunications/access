import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { getResendApiKey, resendFromAddress } from "./resendConfig";
import { fillRandomBytes } from "./random";

export const ResendOTPPasswordReset = Resend({
  id: "resend-password-reset",
  apiKey: getResendApiKey(),
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        fillRandomBytes(bytes);
      },
    };

    const alphabet = "0123456789";
    const length = 8;
    return generateRandomString(random, alphabet, length);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey || getResendApiKey());
    const { error } = await resend.emails.send({
      from: resendFromAddress,
      to: [email],
      subject: "Reset your Access Momentum password",
      text: "Your password reset code is " + token,
    });

    if (error) {
      throw new Error("Could not send");
    }
  },
});
