"use client";

import { useEffect } from "react";
import { usePageHeader } from "@/context/page-header";
import { CRMIntelligenceContent } from "@/components/crm-intelligence/CRMIntelligenceContent";

export default function CRMPage() {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader({
      title: "CRM & Inteligência de Inquilinos",
      description: "Análise de inquilinos, satisfação, demanda e retenção.",
    });
    return () => setPageHeader({ title: null, description: null, action: null });
  }, [setPageHeader]);

  return (
    <div className="space-y-6">
      <CRMIntelligenceContent />
    </div>
  );
}
