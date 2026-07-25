"use server";

import { action } from "@towerjs/gatehouse/next-js";
import { gatehouse } from "@towerjs/gatehouse";
import { tower } from "towerjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const signIn = action(async (formData: FormData) => {
  const result = await gatehouse.signIn.email({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (result?.user?.email) {
    const h = await headers();
    try {
      await tower.courier.email.send({
        to: result.user.email,
        subject: "New sign-in to your account",
        text: `You signed in to Tower Example.\nIP: ${h.get("x-forwarded-for") ?? "unknown"}\nDevice: ${h.get("user-agent") ?? "unknown"}`,
      });
    } catch {
      // login alert is best-effort
    }
  }

  redirect("/dashboard");
});

export const signUp = action(async (formData: FormData) => {
  await gatehouse.signUp.email({
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });
  redirect("/sign-in?verified=signup");
});

export const signOut = action(async () => {
  await gatehouse.sessions.signOut();
  redirect("/sign-in");
});
