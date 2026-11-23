import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { useState, useEffect, useRef } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/useAuth";
import { useToast } from "../../../context/useToast";
import { LoginSkeleton } from "../../../components/skeletons";
import { apiClient, getErrorMessage } from "../../../api/client";
import {
  IconShield,
  IconSparkles,
  IconCheck,
  IconExclamation,
  IconMail,
  IconLock,
  IconArrowLeft,
  IconClock,
} from "../../../components/Icons";
import { useDocumentTitle } from "../../../utils/useDocumentTitle";

type AuthMode = "signin" | "register";
type AuthStage = "CREDENTIALS" | "OTP";

function getSafeRedirect(path?: string): string {
  if (!path) return "/dashboard";
  // Disallow external URLs, protocol-relative //, backslash escapes, or data/javascript URIs
  if (path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")) {
    return path;
  }
  return "/dashboard";
}

export default function LoginPage() {
  const location = useLocation();
  const queryMode = new URLSearchParams(location.search).get("mode");
  const [mode, setMode] = useState<AuthMode>(() =>
    queryMode === "register" ? "register" : "signin"
  );
  const [stage, setStage] = useState<AuthStage>("CREDENTIALS");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Status states
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [sandboxWarning, setSandboxWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const otpInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, loading, checkAuth } = useAuth();
  const { toast } = useToast();

  const fromState = (location.state as { from?: { pathname: string; search?: string } })?.from;
  const rawRedirect = fromState
    ? `${fromState.pathname}${fromState.search || ""}`
    : new URLSearchParams(location.search).get("redirect") || "/dashboard";
  const redirectPath = getSafeRedirect(rawRedirect);

  useDocumentTitle(stage === "OTP" ? "Verify Email" : mode === "signin" ? "Sign In" : "Create Account");

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate(redirectPath, { replace: true });
    }
  }, [user, navigate, redirectPath]);

  // Handle countdown timer for OTP resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus OTP input when transitioning to OTP stage
  useEffect(() => {
    if (stage === "OTP") {
      otpInputRef.current?.focus();
    }
  }, [stage]);

  // Google OAuth Success Handler
  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) {
      const msg = "Google did not return a sign-in credential. Please try again.";
      setError(msg);
      toast.error(msg, "Sign In Failed");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const res = await apiClient("/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });

      if (!res.ok) {
        const errorMsg = await getErrorMessage(res, "We could not sign you in with Google. Please try again.");
        setError(errorMsg);
        toast.error(errorMsg, "Google Sign-In Failed");
        setIsSubmitting(false);
        return;
      }

      await checkAuth();
      toast.success("Signed in with Google successfully!", "Welcome");
      navigate(redirectPath, { replace: true });
    } catch {
      const errorMsg = "Unable to reach PocketCircle. Check your connection and try again.";
      setError(errorMsg);
      toast.error(errorMsg, "Connection Error");
      setIsSubmitting(false);
    }
  }

  // Handle Sign In or Registration submission -> requests OTP
  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters long.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const endpoint = mode === "signin" ? "/auth/login" : "/auth/register";
      const payload =
        mode === "signin"
          ? { email: trimmedEmail, password }
          : { name: name.trim(), email: trimmedEmail, password };

      const res = await apiClient(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorDetail =
          data?.detail || "Authentication failed. Please verify your details.";
        setError(errorDetail);
        toast.error(errorDetail, "Sign In Failed");
        setIsSubmitting(false);
        return;
      }

      if (data?.otp_required) {
        setStage("OTP");
        setDevOtp(data.dev_otp || null);
        setSandboxWarning(data.sandbox_warning || null);
        setCooldown(60);
        const msg = data.message || `Verification code sent to ${trimmedEmail}`;
        setInfoMessage(msg);
        toast.info(msg, "Verification Code Sent");
      }
    } catch {
      const connErr = "Unable to connect to the server. Please check your network.";
      setError(connErr);
      toast.error(connErr, "Connection Error");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle OTP verification
  async function handleVerifyOtp(e?: React.FormEvent, customOtp?: string) {
    if (e) e.preventDefault();
    setError("");
    setInfoMessage("");

    const otpToVerify = (customOtp || otp).trim();
    if (otpToVerify.length !== 6) {
      const err = "Please enter the complete 6-digit verification code.";
      setError(err);
      toast.warning(err);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiClient("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), otp: otpToVerify }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errDetail = data?.detail || "Invalid verification code. Please try again.";
        setError(errDetail);
        toast.error(errDetail, "Verification Failed");
        setIsSubmitting(false);
        return;
      }

      await checkAuth();
      toast.success(
        mode === "register"
          ? "Account verified and ready! Welcome to PocketCircle."
          : "Welcome back!",
        "Authentication Successful"
      );
      navigate(redirectPath, { replace: true });
    } catch {
      const netErr = "Verification failed. Please check your network and try again.";
      setError(netErr);
      toast.error(netErr, "Network Error");
      setIsSubmitting(false);
    }
  }

  // Handle Resending OTP
  async function handleResendOtp() {
    if (cooldown > 0 || isSubmitting) return;

    setError("");
    setInfoMessage("");
    setIsSubmitting(true);

    try {
      const res = await apiClient("/auth/resend-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const resendErr = data?.detail || "Could not resend verification code. Please try again.";
        setError(resendErr);
        toast.error(resendErr, "Resend Failed");
        setIsSubmitting(false);
        return;
      }

      setCooldown(60);
      setDevOtp(data?.dev_otp || null);
      setSandboxWarning(data?.sandbox_warning || null);
      const resendMsg = data?.message || "A new verification code has been sent to your email.";
      setInfoMessage(resendMsg);
      toast.info(resendMsg, "Code Resent");
    } catch {
      const reqErr = "Unable to request new code. Check your network.";
      setError(reqErr);
      toast.error(reqErr, "Connection Error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <LoginSkeleton />;
  }

  if (user) {
    return <Navigate to={redirectPath} replace />;
  }


  return (
    <div className="mx-auto grid min-h-[65vh] max-w-5xl items-center gap-12 py-8 lg:grid-cols-2">
      {/* Left Column: Editorial Value Proposition */}
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-sand bg-parchment px-3 py-1 text-xs font-medium text-ink-black shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-electric-blue" />
            <span>Secure Authentication</span>
          </span>
        </div>

        <h1 className="pc-display text-ink-black leading-[1.08]">
          Access your circle&apos;s ledger.
        </h1>

        <p className="max-w-xl text-lg font-normal leading-relaxed text-steel">
          Sign in seamlessly using email, password, and OTP email confirmation, or continue with Google.
          PocketCircle generates your private 10-digit numeric Pocket ID for zero-trace debt settlement.
        </p>

        {/* Value Checklist */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3 rounded-xl border border-sand bg-parchment/60 p-3.5">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
              <IconCheck size={12} />
            </span>
            <span className="text-sm font-medium text-ink-black">
              Zero bank passwords or UPI PINs ever requested
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-sand bg-parchment/60 p-3.5">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
              <IconCheck size={12} />
            </span>
            <span className="text-sm font-medium text-ink-black">
              10-digit numeric Pocket ID for private friend search
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-sand bg-parchment/60 p-3.5">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
              <IconCheck size={12} />
            </span>
            <span className="text-sm font-medium text-ink-black">
              Two-factor OTP email verification for complete account safety
            </span>
          </div>
        </div>
      </section>

      {/* Right Column: Interactive Authentication Card */}
      <section className="relative">
        <div className="rounded-2xl border border-sand bg-paper-white p-7 sm:p-9 space-y-6 shadow-xs">
          {stage === "CREDENTIALS" ? (
            <>
              {/* Header with Mode Toggle */}
              <div className="space-y-3 border-b border-sand pb-5">
                <div className="flex items-center justify-end">
                  <div className="inline-flex rounded-full border border-sand bg-parchment p-0.5 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setError("");
                      }}
                      className={`rounded-full px-3.5 py-1 transition-all ${
                        mode === "signin"
                          ? "bg-paper-white text-ink-black shadow-sm font-semibold"
                          : "text-steel hover:text-ink-black"
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setError("");
                      }}
                      className={`rounded-full px-3.5 py-1 transition-all ${
                        mode === "register"
                          ? "bg-paper-white text-ink-black shadow-sm font-semibold"
                          : "text-steel hover:text-ink-black"
                      }`}
                    >
                      Create Account
                    </button>
                  </div>
                </div>

                <h2 className="text-2xl font-semibold text-ink-black">
                  {mode === "signin" ? "Sign In to PocketCircle" : "Create your Account"}
                </h2>
                <p className="text-sm text-steel">
                  {mode === "signin"
                    ? "Enter your credentials. We'll send an OTP to your email to confirm your login."
                    : "Fill in your details below. You will receive an OTP to confirm your email."}
                </p>
              </div>

              {/* Email & Password Form */}
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                {mode === "register" && (
                  <div className="space-y-1.5">
                    <label htmlFor="auth-full-name" className="block text-xs font-medium text-steel">
                      Full name
                    </label>
                    <input
                      id="auth-full-name"
                      type="text"
                      required
                      placeholder="e.g. Alex Morgan"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pc-input"
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="auth-email" className="block text-xs font-medium text-steel">
                    Email address
                  </label>
                  <div className="relative">
                    <input
                      id="auth-email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pc-input !pr-10"
                      disabled={isSubmitting}
                      autoComplete="email"
                    />
                    <IconMail
                      size={18}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-steel pointer-events-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="auth-password" className="flex items-center gap-1.5 text-xs font-medium text-steel">
                      <IconLock size={13} />
                      <span>Password</span>
                    </label>
                    {mode === "register" && (
                      <span className="text-[11px] text-steel">Min. 8 characters</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pc-input !pr-20"
                      disabled={isSubmitting}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-steel hover:text-ink-black"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div
                    className="flex items-start gap-2.5 rounded-[12px] border border-red-200 bg-red-50 p-3.5 text-xs text-red-700"
                    role="alert"
                  >
                    <IconExclamation size={16} className="shrink-0 mt-0.5 text-red-600" />
                    <p className="font-medium leading-relaxed">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="pc-btn pc-btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>
                      {mode === "signin" ? "Continue with Password" : "Create Account & Send OTP"}
                    </span>
                  )}
                </button>
              </form>

              {/* Or Divider */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="w-full border-t border-sand" />
                <span className="absolute bg-paper-white px-3 text-xs uppercase tracking-wider text-steel font-medium">
                  or
                </span>
              </div>

              {/* Google Login Component */}
              <div className="space-y-4">
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
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
              </div>
            </>
          ) : (
            /* Stage 2: OTP Verification */
            <div className="space-y-6">
              {/* OTP Header */}
              <div className="space-y-2 border-b border-sand pb-5">
                <button
                  type="button"
                  onClick={() => {
                    setStage("CREDENTIALS");
                    setOtp("");
                    setError("");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-steel hover:text-ink-black mb-1 transition-colors"
                >
                  <IconArrowLeft size={14} />
                  <span>Use different credentials</span>
                </button>

                <h2 className="text-2xl font-semibold text-ink-black flex items-center gap-2">
                  <span>Confirm Email Login</span>
                </h2>
                <p className="text-sm text-steel leading-relaxed">
                  We sent a 6-digit verification code to{" "}
                  <span className="font-semibold text-ink-black">{email}</span>. Please enter it
                  below to complete your authentication.
                </p>
              </div>

              {/* Sandbox Warning Notice */}
              {sandboxWarning && (
                <div className="rounded-[16px] border border-amber-300 bg-amber-50/90 p-4 space-y-2 text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <IconExclamation size={15} className="text-amber-600" />
                    <span>Resend Sandbox Notice</span>
                  </div>
                  <p className="leading-relaxed text-amber-800">
                    Resend&apos;s default testing domain (<code>onboarding@resend.dev</code>) restricts email delivery strictly to the account owner (<strong>bhoraniyadevendra@gmail.com</strong>).
                  </p>
                  {devOtp && (
                    <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                      <span className="text-amber-900">
                        Verification code: <strong className="font-mono text-sm tracking-wider text-ink-black">{devOtp}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setOtp(devOtp);
                          void handleVerifyOtp(undefined, devOtp);
                        }}
                        className="font-bold text-electric-blue hover:underline text-xs"
                      >
                        Autofill & Submit &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Dev Mode Code Assist Helper */}
              {devOtp && !sandboxWarning && (
                <div className="rounded-[16px] border border-blue-200 bg-blue-50/70 p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-electric-blue flex items-center gap-1.5">
                      <IconSparkles size={14} />
                      <span>Development Mode Active</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOtp(devOtp);
                        void handleVerifyOtp(undefined, devOtp);
                      }}
                      className="font-medium text-electric-blue hover:underline text-xs"
                    >
                      Autofill & Submit
                    </button>
                  </div>
                  <p className="text-steel">
                    Your generated verification code is:{" "}
                    <strong className="text-ink-black font-mono text-sm tracking-wider">
                      {devOtp}
                    </strong>
                  </p>
                </div>
              )}

              {/* Info Message */}
              {infoMessage && !error && (
                <div className="flex items-start gap-2.5 rounded-[12px] border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <IconCheck size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                  <p className="font-medium">{infoMessage}</p>
                </div>
              )}

              {/* OTP Form */}
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="login-otp" className="block text-xs font-semibold uppercase tracking-wider text-steel text-center">
                    6-Digit Verification Code
                  </label>
                  <input
                    id="login-otp"
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    placeholder="••••••"
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtp(val);
                      if (val.length === 6) {
                        void handleVerifyOtp(undefined, val);
                      }
                    }}
                    className="pc-input text-center font-mono text-2xl font-bold tracking-[0.5em] h-14"
                    disabled={isSubmitting}
                  />
                  <p className="text-[12px] text-center text-steel">
                    Code expires in 10 minutes.
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div
                    className="flex items-start gap-2.5 rounded-[12px] border border-red-200 bg-red-50 p-3.5 text-xs text-red-700"
                    role="alert"
                  >
                    <IconExclamation size={16} className="shrink-0 mt-0.5 text-red-600" />
                    <p className="font-medium leading-relaxed">{error}</p>
                  </div>
                )}

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || otp.length !== 6}
                  className="pc-btn pc-btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Verifying code...</span>
                    </>
                  ) : (
                    <span>Verify & Sign In</span>
                  )}
                </button>

                {/* Resend OTP */}
                <div className="pt-2 text-center text-xs text-steel">
                  Didn&apos;t receive the code?{" "}
                  {cooldown > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-steel">
                      <IconClock size={12} />
                      Resend in {cooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isSubmitting}
                      className="font-semibold text-electric-blue hover:underline"
                    >
                      Resend Code
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Security badge footer */}
          <div className="flex items-center gap-2 border-t border-sand pt-5 text-xs text-steel">
            <IconShield size={16} className="text-electric-blue shrink-0" />
            <span>256-bit encrypted authentication. Privacy guaranteed.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
