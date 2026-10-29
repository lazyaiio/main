import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Help",
  description: "How to connect a Facebook Page, create posts, schedule them, and fix common problems.",
};

const toc = [
  { id: "start", label: "Getting started" },
  { id: "write", label: "Writing posts" },
  { id: "approve", label: "Scheduling your posts" },
  { id: "status", label: "What each status means" },
  { id: "fix", label: "When something goes wrong" },
  { id: "images", label: "Images" },
  { id: "account", label: "Your data and account" },
];

export default function HelpPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="border-b border-ink-100 pb-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Help</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-600">
          LazyAI prepares Facebook posts for you. Nothing is published until you schedule it for a time you choose.
        </p>
        <nav aria-label="On this page" className="mt-6">
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="font-medium text-brand underline underline-offset-2">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="mt-2 text-base text-ink-700 [&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5">
        <h2 id="start">Getting started</h2>
        <ol>
          <li>Create your account and finish the short setup (your name, workspace name, and time zone). Posts are scheduled in your workspace time zone, which you can change in Settings.</li>
          <li>Open <strong>Pages</strong> and choose <strong>Connect Facebook</strong>. Allow every permission Facebook shows, then pick the Page you want to use.</li>
          <li>Open <strong>Projects</strong> and create a project for a business or topic. Posts and campaigns belong to a project.</li>
        </ol>
        <p>
          LazyAI works with Facebook <strong>Pages</strong>. Personal profiles are not supported. You need a role on the Page that lets you create posts.
        </p>

        <h2 id="write">Writing posts</h2>
        <ul>
          <li><strong>One post:</strong> open Content, choose New, pick a project, a topic, and a language (English or Bengali), then generate. You can edit every word.</li>
          <li><strong>From an article:</strong> paste a link and LazyAI reads the page to write a post from it. Pages behind a login or a paywall cannot be read.</li>
          <li><strong>A whole campaign:</strong> open Campaigns to plan many posts at once. They are written in small batches, so a long campaign can take a few minutes, and you can leave and come back.</li>
        </ul>
        <p>AI can make mistakes. Read every post before it goes out.</p>

        <h2 id="approve">Scheduling your posts</h2>
        <ol>
          <li>A new post is <strong>ready</strong> right away. Read it, and edit it if you like. Saving never changes its status.</li>
          <li>On the post, pick the connected Page and a date and time, then schedule it. The time must be a few minutes from now or later.</li>
          <li>Use <strong>Calendar</strong> to see what is planned. You can change the time or cancel a scheduled post at any time before it goes out.</li>
        </ol>

        <h2 id="status">What each status means</h2>
        <ul>
          <li><strong>Scheduled:</strong> waiting for its time.</li>
          <li><strong>Publishing:</strong> being sent to Facebook right now.</li>
          <li><strong>Retrying:</strong> Facebook asked LazyAI to wait, or there was a short problem. It tries again automatically.</li>
          <li><strong>Published:</strong> Facebook confirmed the post. LazyAI never shows Published before that.</li>
          <li><strong>Failed:</strong> it did not go out. The reason is shown on the post, with a button to retry.</li>
          <li><strong>Canceled:</strong> you stopped it. Nothing was posted.</li>
        </ul>

        <h2 id="fix">When something goes wrong</h2>
        <h3>A post says it could not be confirmed</h3>
        <p>
          Sometimes the connection drops at the exact moment a post is sent, so LazyAI cannot tell whether it reached Facebook. To avoid posting twice, it will not retry by itself. Open your Page and look. Then choose
          <strong> It is on my Page</strong> or <strong>It is not there: post it again</strong>.
        </p>
        <h3>A post was more than 6 hours late</h3>
        <p>If the service was down when a post was due, LazyAI does not publish it hours later by surprise. Retry it, or choose a new time.</p>
        <h3>The Page needs to be reconnected</h3>
        <p>This happens when Facebook access was removed or expired, or your role on the Page changed. Open Pages and reconnect. Your posts and schedules are kept.</p>
        <h3>I did not get an email</h3>
        <p>Check your spam folder. You can choose which emails you get in Settings.</p>

        <h2 id="images">Images</h2>
        <p>Upload JPG, PNG, WebP, or GIF files up to 4 MB and 8,000 pixels on the longest side. Add a short description (alt text) so the image is understood by people who cannot see it. Attach an image to a post from Media or from the post itself.</p>

        <h2 id="account">Your data and account</h2>
        <ul>
          <li><strong>Download your data:</strong> Settings, then Your data. You get your content, schedules, and activity as a file.</li>
          <li><strong>Delete your account:</strong> Settings, then Delete my account. This removes your workspace and erases saved Facebook access. Posts already on Facebook stay there.</li>
          <li><strong>Facebook data:</strong> to ask us to delete data connected to Facebook, see <Link href="/data-deletion">Data deletion</Link>.</li>
        </ul>

        <h2>Still stuck?</h2>
        <p>
          Write to us at <ContactEmail />. Tell us what you clicked and what you saw. Never send a password. You can read how we handle data in the <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </article>
  );
}
