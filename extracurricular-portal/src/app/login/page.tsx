import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  const demoMode = process.env.DEMO_MODE === "true";
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 bg-background">
      <div className="mb-8 text-center">
        <span className="h-12 w-12 rounded-2xl bg-primary text-white grid place-items-center text-lg font-bold mx-auto mb-4">
          EA
        </span>
        <h1 className="text-xl font-semibold">Extracurricular Activities</h1>
        <p className="text-sm text-muted mt-1">Career counselling opportunities, deadlines & reminders</p>
      </div>
      <LoginForm demoMode={demoMode} googleEnabled={googleEnabled} />
    </div>
  );
}
