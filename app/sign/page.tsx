import { SignFlow } from "@/components/sign-flow";

interface SignPageProps {
  searchParams: Promise<{
    session_id?: string;
  }>;
}

export default async function SignPage({ searchParams }: SignPageProps) {
  const params = await searchParams;

  return <SignFlow sessionId={params.session_id} />;
}
