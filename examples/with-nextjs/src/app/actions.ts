"use server";

import { action } from "@towerjs/gatehouse/next-js";
import { gatehouse } from "@towerjs/gatehouse";
import { redirect } from "next/navigation";

export const signIn = action(async (formData: FormData) => {
  await gatehouse.signIn.email({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });
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
