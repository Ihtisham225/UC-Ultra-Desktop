/**
 * How the shared security pieces reach the server. Only this file differs
 * between the apps: on the web the server actions, here `rpc()`.
 * ⚠️ `rpc` is variadic — each argument is its own parameter.
 */
import { rpc } from "@/lib/apiClient";
import type { PrivacySettings } from "@/lib/privacy";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface SecurityStatusDto {
  mfa_enabled: boolean;
  mfa_enabled_at: string | null;
  recovery_codes_left: number;
  privacy: PrivacySettings;
}

export const securityApi = {
  status: () => rpc<SecurityStatusDto>("getSecurityStatusAction"),
  startSetup: () => rpc<Result<{ secret: string; otpauth_url: string; qr_svg: string }>>("startMfaSetupAction"),
  confirmSetup: (code: string) => rpc<Result<{ recovery_codes: string[] }>>("confirmMfaSetupAction", code),
  disable: (token: string) => rpc<Result>("disableMfaAction", token),
  regenerateCodes: (token: string) => rpc<Result<{ recovery_codes: string[] }>>("regenerateRecoveryCodesAction", token),
  savePrivacy: (input: PrivacySettings, token: string) => rpc<Result<{ privacy: PrivacySettings }>>("savePrivacyAction", input, token),
  verify: (code: string) => rpc<Result<{ token: string; used_recovery: boolean }>>("verifyMfaAction", code),
};
