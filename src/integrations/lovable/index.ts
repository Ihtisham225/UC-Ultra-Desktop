// Desktop stub — routes OAuth directly through Supabase (no Lovable cloud dependency)
import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: (provider === "lovable" || provider === "microsoft") ? "google" : provider as "google" | "apple",
        options: {
          redirectTo: opts?.redirect_uri,
          queryParams: opts?.extraParams,
        },
      });
      if (error) return { error };
      return { redirected: true };
    },
  },
};
