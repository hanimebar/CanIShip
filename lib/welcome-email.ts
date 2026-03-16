/**
 * Welcome email — sent once when a new user signs up.
 */

import { Resend } from 'resend'

export async function sendWelcomeEmail(email: string, name?: string) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const firstName = name?.split(' ')[0] || 'builder'

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to CanIShip</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0D0D;font-family:'Courier New',Courier,monospace;color:#FFFFFF;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <!-- Logo -->
    <div style="margin-bottom:32px;">
      <span style="font-size:22px;font-weight:800;color:#00FF88;letter-spacing:-0.5px;">Can</span><span style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">IShip</span>
    </div>

    <!-- Hero -->
    <div style="background:#111111;border:1px solid #1E1E1E;border-radius:16px;padding:36px;margin-bottom:24px;">
      <div style="display:inline-block;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);border-radius:999px;padding:4px 12px;font-size:11px;color:#00FF88;margin-bottom:20px;letter-spacing:0.5px;">
        ● ACCOUNT ACTIVATED
      </div>

      <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#FFFFFF;line-height:1.2;">
        yo ${firstName}, you're in. 🚀
      </h1>

      <p style="margin:0 0 16px;font-size:15px;color:#9999AA;line-height:1.6;">
        Welcome to <strong style="color:#FFFFFF;">CanIShip</strong> — the AI QA tool that tells you straight up whether your app is ready to ship or needs another pass.
      </p>

      <p style="margin:0 0 24px;font-size:15px;color:#9999AA;line-height:1.6;">
        No gatekeeping. No jargon. Just you, your URL, and a <strong style="color:#00FF88;">ShipScore</strong> in minutes.
      </p>

      <a href="https://caniship.actvli.com/audit/new"
         style="display:inline-block;background:#00FF88;color:#0D0D0D;font-weight:800;font-size:14px;padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
        Run your first audit →
      </a>
    </div>

    <!-- What you get -->
    <div style="background:#111111;border:1px solid #1E1E1E;border-radius:16px;padding:28px;margin-bottom:24px;">
      <h2 style="margin:0 0 20px;font-size:14px;font-weight:700;color:#FFFFFF;letter-spacing:1px;text-transform:uppercase;">
        What just dropped in your lap
      </h2>

      <div style="margin-bottom:14px;display:flex;align-items:flex-start;gap:12px;">
        <span style="color:#FF3B30;font-weight:700;font-size:11px;background:rgba(255,59,48,0.1);border-radius:4px;padding:2px 6px;flex-shrink:0;margin-top:1px;">FUNCTIONAL</span>
        <span style="font-size:14px;color:#CCCCCC;">Playwright crawls every flow and catches broken interactions before your users do</span>
      </div>

      <div style="margin-bottom:14px;display:flex;align-items:flex-start;gap:12px;">
        <span style="color:#AF52DE;font-weight:700;font-size:11px;background:rgba(175,82,222,0.1);border-radius:4px;padding:2px 6px;flex-shrink:0;margin-top:1px;">A11Y</span>
        <span style="font-size:14px;color:#CCCCCC;">axe-core WCAG 2.1 AA audit — every violation, rated by severity</span>
      </div>

      <div style="margin-bottom:14px;display:flex;align-items:flex-start;gap:12px;">
        <span style="color:#0A84FF;font-weight:700;font-size:11px;background:rgba(10,132,255,0.1);border-radius:4px;padding:2px 6px;flex-shrink:0;margin-top:1px;">PERF</span>
        <span style="font-size:14px;color:#CCCCCC;">Lighthouse Core Web Vitals — LCP, CLS, FCP against real targets</span>
      </div>

      <div style="display:flex;align-items:flex-start;gap:12px;">
        <span style="color:#CC0000;font-weight:700;font-size:11px;background:rgba(204,0,0,0.1);border-radius:4px;padding:2px 6px;flex-shrink:0;margin-top:1px;">SEC</span>
        <span style="font-size:14px;color:#CCCCCC;">Security headers, HTTPS posture, exposed data — all checked</span>
      </div>
    </div>

    <!-- Free tier note -->
    <div style="background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.15);border-radius:12px;padding:20px;margin-bottom:32px;">
      <p style="margin:0;font-size:13px;color:#9999AA;line-height:1.6;">
        <strong style="color:#00FF88;">Free tier:</strong> 3 audits/month, Quick Scan. Need more? The Builder plan is €19/month — unlimited depths, full history, no babysitting.
        <a href="https://caniship.actvli.com/pricing" style="color:#00FF88;text-decoration:none;margin-left:4px;">Check pricing →</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1E1E1E;padding-top:24px;font-size:12px;color:#444455;line-height:1.8;">
      <p style="margin:0 0 4px;">
        <strong style="color:#666677;">CanIShip</strong> — a product by Äctvli Responsible Consulting
      </p>
      <p style="margin:0;">
        Questions? Reply to this email or reach us at
        <a href="mailto:reachout@actvli.com" style="color:#00FF88;text-decoration:none;">reachout@actvli.com</a>
      </p>
    </div>

  </div>
</body>
</html>`

  await resend.emails.send({
    from: 'CanIShip <reachout@actvli.com>',
    to: email,
    subject: `yo ${firstName}, your ShipScore awaits 🚢`,
    html,
  })
}
