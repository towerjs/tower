import { defineTower } from "@towerjs/blueprint";

export default defineTower({
  modules: {
    vault: { provider: "neon" },
    gatehouse: {
      provider: "better-auth",
      appName: "Tower Example",
      credentials: {
        enabled: true,
        autoSignIn: true,
      },
      emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({
          user,
          url,
        }: {
          user: { id: string; email: string; name: string };
          url: string;
          token: string;
        }) => {
          console.log(`[email] Verify your email: ${url}`);
        },
      },
    },
  },
});
