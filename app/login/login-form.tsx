"use client";

import { startTransition, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

import styles from "./login.module.css";

type AuthMode = "signin" | "signup";

type LoginFormProps = {
  authConfigured: boolean;
  initialStatus: string | null;
  missingVariables: string[];
};

function getSafeNext(nextParam: string | null) {
  if (!nextParam || !nextParam.startsWith("/")) {
    return "/dashboard";
  }

  return nextParam;
}

function getEmailRedirectTo(nextPath: string) {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`;
}

function isEmailConfirmationError(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("email not confirmed") ||
    normalizedMessage.includes("email link is invalid or has expired") ||
    normalizedMessage.includes("signup requires email confirmation")
  );
}

export function LoginForm({
  authConfigured,
  initialStatus,
  missingVariables,
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const missingVariablesText = missingVariables.length ? missingVariables.join(" and ") : "the required Supabase environment variables";
  const backendUnavailableMessage = `This deployment is missing ${missingVariablesText}. Add them in Vercel Project Settings, then redeploy before using sign-in.`;
  const [mode, setMode] = useState<AuthMode>("signin");
  const [emailAddress, setEmailAddress] = useState("");
  const [errorMessage, setErrorMessage] = useState(
    !authConfigured || initialStatus === "backend_unavailable"
      ? backendUnavailableMessage
      : initialStatus === "confirm_failed"
      ? "We could not confirm that email link. Request a fresh signup link or sign in if you already confirmed the account."
      : "",
  );
  const [successMessage, setSuccessMessage] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(initialStatus === "confirm_failed");
  const [isPending, setIsPending] = useState(false);

  const nextPath = getSafeNext(searchParams.get("next"));

  const handleResendConfirmation = async () => {
    if (!authConfigured) {
      setErrorMessage(backendUnavailableMessage);
      setNeedsConfirmation(false);
      return;
    }

    const email = emailAddress.trim();

    if (!email) {
      setErrorMessage("Enter the email address you used for signup, then resend the confirmation link.");
      setNeedsConfirmation(true);
      return;
    }

    setIsPending(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: getEmailRedirectTo(nextPath),
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setNeedsConfirmation(true);
        return;
      }

      setSuccessMessage(
        "A fresh confirmation link is on the way. Open that email, finish confirmation, and then sign in here.",
      );
      setNeedsConfirmation(true);
      setMode("signin");
    } finally {
      setIsPending(false);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    if (!authConfigured) {
      setErrorMessage(backendUnavailableMessage);
      setNeedsConfirmation(false);
      return;
    }

    const emailValue = formData.get("email");
    const passwordValue = formData.get("password");
    const businessNameValue = formData.get("business_name");
    const email = typeof emailValue === "string" ? emailValue.trim() : "";
    const password = typeof passwordValue === "string" ? passwordValue : "";
    const businessName = typeof businessNameValue === "string" ? businessNameValue.trim() : "";

    if (!email || !password) {
      setErrorMessage("Email and password are required.");
      return;
    }

    setEmailAddress(email);
    setIsPending(true);
    setErrorMessage("");
    setSuccessMessage("");
    setNeedsConfirmation(false);

    const supabase = createClient();

    startTransition(async () => {
      try {
        if (mode === "signin") {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            if (isEmailConfirmationError(error.message)) {
              setErrorMessage(
                "This account exists, but the email address has not been confirmed yet. Confirm the email we sent or resend a fresh confirmation link below.",
              );
              setNeedsConfirmation(true);
              return;
            }

            setErrorMessage(error.message);
            return;
          }

          setNeedsConfirmation(false);
          router.push(nextPath);
          router.refresh();
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getEmailRedirectTo(nextPath),
            data: businessName ? { business_name: businessName } : undefined,
          },
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        if (data.session) {
          router.push(nextPath);
          router.refresh();
          return;
        }

        setSuccessMessage(
          "Account created. Hosted Supabase projects usually require email confirmation before password login. Check your inbox for the confirmation link, then come back and sign in.",
        );
        setNeedsConfirmation(true);
        setMode("signin");
      } finally {
        setIsPending(false);
      }
    });
  };

  return (
    <div className={styles.authStack}>
      <div className={styles.modeToggle} role="tablist" aria-label="Authentication mode">
        <button
          className={mode === "signin" ? styles.modeButtonActive : styles.modeButton}
          type="button"
          onClick={() => setMode("signin")}
          disabled={!authConfigured}
        >
          Sign in
        </button>
        <button
          className={mode === "signup" ? styles.modeButtonActive : styles.modeButton}
          type="button"
          onClick={() => setMode("signup")}
          disabled={!authConfigured}
        >
          Create account
        </button>
      </div>

      <form
        className={styles.form}
        action={async (formData) => {
          await handleSubmit(formData);
        }}
      >
        <label className={styles.field}>
          <span>Email</span>
          <input
            name="email"
            type="email"
            placeholder="you@shopname.com"
            autoComplete="email"
            value={emailAddress}
            onChange={(event) => setEmailAddress(event.target.value)}
            disabled={!authConfigured || isPending}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            name="password"
            type="password"
            placeholder="At least 6 characters"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            disabled={!authConfigured || isPending}
            required
          />
        </label>

        {mode === "signup" ? (
          <label className={styles.field}>
            <span>Business name</span>
            <input
              name="business_name"
              type="text"
              placeholder="Andy's Card Table"
              autoComplete="organization"
              disabled={!authConfigured || isPending}
            />
          </label>
        ) : null}

        <button className={styles.submitButton} type="submit" disabled={isPending || !authConfigured}>
          {isPending ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}
      {successMessage ? <p className={styles.successMessage}>{successMessage}</p> : null}
      {!authConfigured ? (
        <p className={styles.helperText}>
          Required for this deployment: {missingVariablesText}. Once those are present, the email
          confirmation and password flows will work normally.
        </p>
      ) : null}
      {needsConfirmation ? (
        <div className={styles.supportActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleResendConfirmation}
            disabled={isPending || !authConfigured}
          >
            {isPending ? "Sending..." : "Resend confirmation email"}
          </button>
          <p className={styles.helperText}>
            Use the same email address you signed up with. The new link will bring you back here and finish confirmation through Supabase.
          </p>
        </div>
      ) : null}
    </div>
  );
}
