import { gatehouse } from "@towerjs/gatehouse";

const { handler } = gatehouse.proxy({
  public: ["/", "/sign-in", "/sign-up"],
  redirectIfAuthenticated: ["/sign-in", "/sign-up"],
  redirectTo: "/sign-in",
  redirectAfterSignIn: "/dashboard",
});

export function proxy(request: Request) {
  return handler(request);
}

export const config = {
  matcher: ["/((?!_next/static|favicon.ico|api/auth).*)"],
};
