import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/useAuth";

import { apiClient, getErrorMessage } from "../../../api/client";

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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="pc-sticker-card pc-sticker-cyan px-8 py-10 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full border border-black bg-toxic-lime" />
          <div className="font-bold text-black">
            Signing you in securely...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-5xl items-center gap-8 py-8 lg:grid-cols-2">
      <section className="space-y-6">
        <span className="pc-kicker">Friends, not finance bros</span>
        <h1 className="pc-display">
          Split it.<br />Keep it clear.
        </h1>
        <p className="max-w-xl text-lg font-medium leading-7 text-hairline-smoke">
          Sign in to keep your group expenses transparent, organized, and ready to settle.
        </p>
        <ul className="grid gap-3 text-sm font-medium text-black sm:grid-cols-3 lg:grid-cols-1">
          <li className="rounded-2xl border border-black bg-sticker-khaki px-4 py-3"><span className="mr-2 font-black">01</span>Shared view.</li>
          <li className="rounded-2xl border border-black bg-voltage-cyan px-4 py-3"><span className="mr-2 font-black">02</span>No payment handling.</li>
          <li className="rounded-2xl border border-black bg-riot-pink px-4 py-3"><span className="mr-2 font-black">03</span>Google sign-in.</li>
        </ul>
      </section>

      <section className="pc-sticker-card pc-sticker-khaki p-8 sm:p-10">
        <div className="mb-8">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.12em]">Your shared ledger</p>
          <h2 className="pc-section-title text-[clamp(3rem,8vw,4.5rem)]">Get in<br />the circle.</h2>
          <p className="mt-5 text-sm leading-6 text-hairline-smoke">Use Google to create or access your PocketCircle account.</p>
        </div>
        <div className="flex flex-col items-start gap-5">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => setError("Google sign-in was cancelled or unavailable. Please try again.")}
            text="continue_with"
            shape="rectangular"
          />
          {error && (
            <p className="w-full rounded-2xl border border-black bg-riot-pink px-3 py-2 text-sm font-medium text-black" role="alert">
              {error}
            </p>
          )}
          <p className="text-xs leading-5 text-hairline-smoke">
            PocketCircle only uses Google to identify your account. It does not access your password or process payments.
          </p>
        </div>
      </section>
    </div>
  );
}
