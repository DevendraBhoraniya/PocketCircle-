import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/useAuth";
import { apiClient, getErrorMessage } from "../../../api/client";
import { IconShield, IconSparkles, IconCheck, IconExclamation } from "../../../components/Icons";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const navigate = useNavigate();
  const { user, loading, checkAuth } = useAuth();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  async function handleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) {
      setError("Google did not return a sign-in credential. Please try again.");
      return;
    }

    setIsLoggingIn(true);
    setError("");
    try {
      const res = await apiClient("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      if (!res.ok) {
        setError(await getErrorMessage(res, "We could not sign you in. Please try again."));
        setIsLoggingIn(false);
        return;
      }

      await checkAuth();
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Unable to reach PocketCircle. Check your connection and try again.");
      setIsLoggingIn(false);
    }
  }

  if (loading || isLoggingIn) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-12">
        <div className="pc-card pc-card-soft max-w-sm px-8 py-10 text-center space-y-4">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sand border-t-electric-blue" />
          <h2 className="text-xl font-bold tracking-tight text-ink-black">
            Authenticating session
          </h2>
          <p className="text-sm font-normal text-steel">
            Verifying your identity and loading your ledger state.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-[65vh] max-w-5xl items-center gap-12 py-8 lg:grid-cols-2">
      {/* Left Column: Editorial Value Proposition */}
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2">
          <span className="pc-badge pc-badge-soft">
            <IconSparkles size={14} className="text-electric-blue" />
            <span>Secure Authentication</span>
          </span>
        </div>

        <h1 className="pc-display text-ink-black">
          Access your <br />
          circle&apos;s <span className="pc-serif-flourish text-electric-blue">ledger</span>.
        </h1>

        <p className="max-w-xl text-lg font-normal leading-relaxed text-steel">
          Sign in instantly with Google. PocketCircle creates your unique 10-digit numeric Pocket ID
          so friends can connect with you without sharing phone numbers or banking credentials.
        </p>

        {/* Value Checklist */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3 rounded-[16px] border border-sand bg-parchment p-3.5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-electric-blue text-white text-xs">
              <IconCheck size={14} />
            </span>
            <span className="text-sm font-medium text-ink-black">
              Zero bank passwords or UPI PINs ever requested
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-[16px] border border-sand bg-parchment p-3.5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-electric-blue text-white text-xs">
              <IconCheck size={14} />
            </span>
            <span className="text-sm font-medium text-ink-black">
              10-digit numeric Pocket ID for private friend search
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-[16px] border border-sand bg-parchment p-3.5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-electric-blue text-white text-xs">
              <IconCheck size={14} />
            </span>
            <span className="text-sm font-medium text-ink-black">
              Zero-remainder deterministic debt calculations
            </span>
          </div>
        </div>
      </section>

      {/* Right Column: Login Action Card */}
      <section className="relative">
        <div className="rounded-[24px] border border-sand bg-paper-white p-8 sm:p-10 space-y-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="space-y-1.5 border-b border-sand pb-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-steel">
              Command Center
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-ink-black">
              Sign In to PocketCircle
            </h2>
            <p className="text-sm text-steel">
              Choose your Google account to get started or continue where you left off.
            </p>
          </div>

          {/* Google Login Component Container */}
          <div className="space-y-4 pt-2">
            <div className="flex justify-center sm:justify-start">
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={() =>
                  setError("Google sign-in was cancelled or unavailable. Please try again.")
                }
                text="continue_with"
                shape="pill"
                theme="outline"
                size="large"
                width="100%"
              />
            </div>

            {/* Error envelope alert */}
            {error && (
              <div
                className="flex items-start gap-2.5 rounded-[12px] border border-red-200 bg-red-50 p-3.5 text-xs text-red-700"
                role="alert"
              >
                <IconExclamation size={16} className="shrink-0 mt-0.5 text-red-600" />
                <p className="font-medium leading-relaxed">{error}</p>
              </div>
            )}
          </div>

          {/* Security badge footer */}
          <div className="flex items-center gap-2 border-t border-sand pt-5 text-xs text-steel">
            <IconShield size={16} className="text-electric-blue" />
            <span>256-bit encrypted authentication. Privacy guaranteed.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
