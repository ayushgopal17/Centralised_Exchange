"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "./auth-provider";

const schema = z.object({
  username: z.string().trim().min(3, "Use at least 3 characters").max(30, "Keep it under 30 characters"),
  password: z.string().min(6, "Use at least 6 characters").max(72, "Keep it under 72 characters"),
});
type FormData = z.infer<typeof schema>;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const isLogin = mode === "login";

  const submit = async ({ username, password }: FormData) => {
    try {
      if (!isLogin) {
        await api.signup(username, password);
        toast.success("Account created");
      }
      await api.signin(username, password);
      login(username);
      toast.success(isLogin ? "Welcome back" : "Welcome to Nexora");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Unable to continue");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow" />
      <Link href="/" className="auth-brand"><span className="brand-mark">N</span><span>NEXORA</span></Link>
      <section className="auth-card">
        <div className="eyebrow">{isLogin ? "SECURE ACCESS" : "CREATE ACCOUNT"}</div>
        <h1>{isLogin ? "Welcome back" : "Start trading"}</h1>
        <p>{isLogin ? "Sign in to manage your portfolio and orders." : "Create your exchange account in a few seconds."}</p>
        <form onSubmit={handleSubmit(submit)} noValidate>
          <label>Username</label>
          <div className={`input-wrap ${errors.username ? "invalid" : ""}`}><UserRound size={17} /><input autoComplete="username" autoFocus placeholder="trader_01" {...register("username")} /></div>
          {errors.username && <span className="field-error">{errors.username.message}</span>}
          <label>Password</label>
          <div className={`input-wrap ${errors.password ? "invalid" : ""}`}><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} placeholder="••••••••" {...register("password")} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          {errors.password && <span className="field-error">{errors.password.message}</span>}
          <button className="primary-button auth-submit" disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="spin" size={18} /> : null}{isLogin ? "Sign in" : "Create account"}</button>
        </form>
        <div className="auth-switch">{isLogin ? "New to Nexora?" : "Already have an account?"} <Link href={isLogin ? "/register" : "/login"}>{isLogin ? "Create account" : "Sign in"}</Link></div>
      </section>
      <div className="auth-foot"><span><i /> Encrypted session</span><span>REST API · V1</span></div>
    </div>
  );
}
