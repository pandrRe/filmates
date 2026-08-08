import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import * as v from "valibot";
import type { DataModel } from "./_generated/dataModel";

const Email = v.pipe(v.string(), v.trim(), v.email());

const SignUpParameters = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)),
  email: Email,
});

const SignInParameters = v.object({
  email: Email,
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile: (parameters) =>
        parameters.flow === "signUp"
          ? v.parse(SignUpParameters, parameters)
          : v.parse(SignInParameters, parameters),
    }),
  ],
});
