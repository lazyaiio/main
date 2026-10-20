export type RouteDecision =
  | { type: "next" }
  | { type: "redirect"; pathname: string; search?: string };

const PROTECTED = ["/app", "/onboarding"];
const GUEST_ONLY = ["/auth/login", "/auth/signup", "/auth/forgot-password"];

const matches = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/** Pure routing rule used by middleware. */
export function decideRoute(input: {
  pathname: string;
  search?: string;
  isAuthed: boolean;
}): RouteDecision {
  const { pathname, search = "", isAuthed } = input;

  if (!isAuthed && PROTECTED.some((base) => matches(pathname, base))) {
    return {
      type: "redirect",
      pathname: "/auth/login",
      search: `?next=${encodeURIComponent(pathname + search)}`,
    };
  }

  if (isAuthed && GUEST_ONLY.some((base) => matches(pathname, base))) {
    return { type: "redirect", pathname: "/app" };
  }

  return { type: "next" };
}
