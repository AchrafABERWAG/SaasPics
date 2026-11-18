import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email, eventName, slug, planType, password } = await req.json();

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Resend API key missing' }, { status: 500 });
    }

    const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin/${slug}`;
    const liveWallUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/live/${slug}`;

    const { data, error } = await resend.emails.send({
      from: 'Lumina <onboarding@resend.dev>', // Use resend's test domain unless the user configures their own
      to: email, // Note: on free resend tier, you can only send to the email registered with your Resend account. For real clients, domain needs verifying.
      subject: `Bienvenue sur Lumina ! Votre espace ${eventName} est prêt 📸`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; line-height: 1.6;">
          <h2 style="color: #D4AF37;">Félicitations pour votre événement : ${eventName} !</h2>
          
          <p>Votre espace interactif Lumina a bien été créé avec le forfait <strong>${planType === 'premium' ? 'PREMIUM' : 'ESSENTIEL'}</strong>.</p>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #555;">Vos accès Administrateur</h3>
            <p>Conservez ces informations précieusement, elles vous permettront de gérer votre événement.</p>
            <ul>
              <li><strong>Email de connexion :</strong> ${email}</li>
              <li><strong>Mot de passe :</strong> ${password}</li>
            </ul>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #D4AF37; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Accéder à mon Tableau de Bord</a>
          </div>

          <div style="margin-top: 30px;">
            <h3 style="color: #555;">Liens utiles à partager</h3>
            <p>Lien public pour vos invités (Live Wall) :<br/> <a href="${liveWallUrl}" style="color: #1a73e8;">${liveWallUrl}</a></p>
          </div>

          <p style="margin-top: 40px; font-size: 0.9em; color: #777;">
            L'équipe Lumina<br/>
            Cet email est généré automatiquement, merci de ne pas y répondre.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend API Error:', error);
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
