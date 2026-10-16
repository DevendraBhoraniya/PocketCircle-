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
        <div className="pc-sticker-card pc-sticker-cyan max-w-sm px-8 py-10 text-center space-y-4">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full border border-black bg-toxic-lime shadow-[2px_2px_0_#000]" />
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-black">
            AUTHENTICATING...
          </h2>
          <p className="text-sm font-medium text-black">
            Verifying your Google identity and preparing your circle.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-[65vh] max-w-5xl items-center gap-12 py-8 lg:grid-cols-2">
      {/* Left Column: Manifesto & Proof */}
      <section className="space-y-6">
        <span className="pc-kicker">
          <IconSparkles size={13} />
          Safe & Simple Auth
        </span>

        <h1 className="pc-display text-black">
          SPLIT IT.<br />
          KEEP IT<br />
          <span className="inline-block -rotate-1 rounded-[16px] border border-black bg-voltage-cyan px-3 py-1 shadow-[3px_3px_0_#000]">
            CLEAR.
          </span>
        </h1>

        <p className="max-w-xl text-lg font-medium leading-relaxed text-black">
          One-tap sign in with Google. PocketCircle creates your unique 10-digit Pocket ID so friends can find you without exchanging phone numbers.
        </p>

        {/* Value Checklist */}
        <div className="grid gap-3 pt-2 sm:grid-cols-3 lg:grid-cols-1">
          <div className="flex items-center gap-3 rounded-[16px] border border-black bg-card-white p-3.5 shadow-[2px_2px_0_#000]">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-black bg-toxic-lime text-xs font-black">
              <IconCheck size={14} />
            </span>
            <span className="text-sm font-bold text-black">No bank credentials or passwords stored</span>
          </div>

          <div className="flex items-center gap-3 rounded-[16px] border border-black bg-card-white p-3.5 shadow-[2px_2px_0_#000]">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-black bg-riot-pink text-xs font-black text-black">
              <IconCheck size={14} />
            </span>
            <span className="text-sm font-bold text-black">Automatic 10-digit numeric Pocket ID</span>
          </div>

          <div className="flex items-center gap-3 rounded-[16px] border border-black bg-card-white p-3.5 shadow-[2px_2px_0_#000]">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-black bg-voltage-cyan text-xs font-black text-black">
              <IconCheck size={14} />
            </span>
            <span className="text-sm font-bold text-black">Immutable ledger with reviewable history</span>
          </div>
        </div>
      </section>

      {/* Right Column: Login Action Card */}
      <section className="relative">
        <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[24px] border border-black bg-black opacity-10" />

        <div className="relative pc-sticker-card pc-sticker-khaki p-8 sm:p-10 space-y-6">
          <div className="space-y-2 border-b border-black pb-6">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-hairline-smoke">
              Account Access
            </span>
            <h2 className="pc-section-title text-black">
              JOIN YOUR CIRCLE.
            </h2>
            <p className="text-sm font-medium text-black">
              Use your Google account to sign in or create your PocketCircle profile instantly.
            </p>
          </div>

          {/* Google Login Component Container */}
          <div className="space-y-4 pt-2">
            <div className="flex justify-center sm:justify-start">
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={() => setError("Google sign-in was cancelled or unavailable. Please try again.")}
                text="continue_with"
                shape="rectangular"
                theme="outline"
                size="large"
                width="100%"
              />
            </div>

            {error && (
              <div
                className="flex items-start gap-3 rounded-[16px] border border-black bg-riot-pink p-3.5 text-sm font-bold text-black shadow-[2px_2px_0_#000]"
                role="alert"
              >
                <IconExclamation size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 text-xs font-medium text-hairline-smoke">
              <IconShield size={14} className="shrink-0" />
              <span>We never share your email or access your contacts.</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
