import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import {
  createPaymentTransparentCheckout,
  getLatestPaymentCheckout,
} from "@/server/modules/financial/payment-gateway.service";

async function _GET(request, context) {
  try {
    const paymentId = context?.params?.id ? String(context.params.id).trim() : "";
    if (!paymentId) {
      return NextResponse.json({ error: "Informe o pagamento desejado." }, { status: 400 });
    }

    const checkout = await getLatestPaymentCheckout(paymentId);
    if (!checkout) {
      return NextResponse.json({ error: "Checkout nao encontrado." }, { status: 404 });
    }

    return NextResponse.json(checkout);
  } catch (error) {
    console.error("GET /api/payments/[id]/checkout error:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel carregar o checkout PIX." },
      { status: error?.status || 500 }
    );
  }
}

async function _POST(request, context) {
  try {
    const paymentId = context?.params?.id ? String(context.params.id).trim() : "";
    if (!paymentId) {
      return NextResponse.json({ error: "Informe o pagamento desejado." }, { status: 400 });
    }

    const checkout = await createPaymentTransparentCheckout({
      paymentId,
      authUserId: request.auth?.userId || null,
    });

    return NextResponse.json(checkout, { status: 201 });
  } catch (error) {
    console.error("POST /api/payments/[id]/checkout error:", error);
    return NextResponse.json(
      { error: error?.message || "Nao foi possivel gerar o checkout PIX." },
      { status: error?.status || 500 }
    );
  }
}

export const GET = withAuth(_GET);
export const POST = withAuth(_POST);
