import { BindForm } from "@/components/bind-form";

interface BindPageProps {
  searchParams: Promise<{
    redirect?: string;
  }>;
}

export default async function BindPage({ searchParams }: BindPageProps) {
  const params = await searchParams;

  return <BindForm redirectTo={params.redirect} />;
}
