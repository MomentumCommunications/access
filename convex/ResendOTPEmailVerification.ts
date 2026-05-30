import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { getResendApiKey, resendFromAddress } from "./resendConfig";

export const ResendOTPEmailVerification = Resend({
  id: "resend-email-verification",
  apiKey: getResendApiKey(),
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
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
      subject: "Verify your Access Momentum email",
      text: "Your verification code is " + token,
    });

    if (error) {
      throw new Error("Could not send");
    }
  },
});
