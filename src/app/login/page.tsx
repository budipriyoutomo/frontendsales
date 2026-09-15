import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Masuk — Maharasa Sync",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Maharasa Sync</CardTitle>
          <CardDescription>
            Masuk untuk melihat penjualan dan status sinkronisasi outlet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm nextPath={typeof next === "string" ? next : undefined} />
        </CardContent>
      </Card>
    </main>
  );
}
