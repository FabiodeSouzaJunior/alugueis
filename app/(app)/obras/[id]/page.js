"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ObraIndexPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  useEffect(() => {
    if (id) router.replace(`/obras/${id}/dashboard`);
  }, [id, router]);

  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-muted-foreground">Redirecionando...</p>
    </div>
  );
}
