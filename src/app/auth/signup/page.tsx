import { redirect } from "next/navigation";

// Creating an account now starts on the pricing page: people choose a plan (free or paid) first.
export default function SignupPage() {
  redirect("/pricing");
}
