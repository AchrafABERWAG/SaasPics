import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia',
});

export async function POST(req: Request) {
  try {
    const { planType } = await req.json(); // 'essential' | 'premium'

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe keys are missing. Please configure STRIPE_SECRET_KEY." },
        { status: 500 }
      );
    }

    let priceAmount = 0;
    let productName = '';

    if (planType === 'essential') {
      priceAmount = 5900; // 59.00 EUR
      productName = 'Pack Essentiel Lumina';
    } else if (planType === 'premium') {
      priceAmount = 9900; // 99.00 EUR
      productName = 'Pack Premium Lumina';
    } else {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: productName,
            },
            unit_amount: priceAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/create?plan=${planType}&payment_status=success`,
      cancel_url: `${origin}/pricing?canceled=true`,
    });

    return NextResponse.json({ url: session.url });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
