import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Cookie Notice",
  description: "The cookies LazyAI uses. Today only strictly necessary cookies are used.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Notice"
      intro="LazyAI uses only the cookies it needs to work. We do not use advertising or tracking cookies."
    >
      <h2>1. What cookies are</h2>
      <p>
        Cookies are small text files that a website stores in your browser. Some are needed for a website to work, for example to keep you signed in.
      </p>

      <h2>2. Cookies we use</h2>
      <p>These cookies are strictly necessary, so they are set without asking for consent:</p>
      <ul>
        <li>
          <strong>Sign-in session cookies</strong> (names start with <code>sb-</code>): set by our authentication provider (Supabase) when you sign in. They keep
          you signed in and protect your account. They last for your session and are refreshed while you use the Service.
        </li>
        <li>
          <strong>Facebook connection cookie</strong> (<code>lazyai_meta_flow</code>): set only while you connect a Facebook Page. It lets us confirm that the
          person who comes back from Facebook is the same person who started the connection. It is marked HttpOnly and expires after 10 minutes or when the
          connection finishes.
        </li>
      </ul>

      <h2>3. Cookies we do not use</h2>
      <ul>
        <li>We do not use advertising, retargeting, or cross-site tracking cookies.</li>
        <li>We do not currently use analytics cookies.</li>
      </ul>
      <p>
        If we add analytics or other optional cookies in the future, we will update this notice and ask for your consent first where the law requires it.
      </p>

      <h2>4. Third-party cookies</h2>
      <p>
        When you sign in to Facebook to connect a Page, Facebook sets its own cookies on facebook.com under its own policies. LazyAI does not control them. See
        Meta’s cookie policy for details.
      </p>

      <h2>5. Your choices</h2>
      <p>
        You can delete or block cookies in your browser settings. If you block the necessary cookies, you will not be able to stay signed in to LazyAI. See our{" "}
        <Link href="/privacy">Privacy Policy</Link> for how we handle personal information, or contact us at <ContactEmail />.
      </p>
    </LegalPage>
  );
}
