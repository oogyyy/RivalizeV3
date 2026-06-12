// NOTE: nodemailer and @types/nodemailer are required but not yet installed.
// Run: npm install nodemailer @types/nodemailer
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendTeamInviteEmail({
  to,
  inviterName,
  teamName,
  teamId,
  token,
  appUrl,
}: {
  to: string
  inviterName: string
  teamName: string
  teamId: string
  token: string
  appUrl: string
}) {
  const inviteUrl = `${appUrl}/invite/${token}`
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER

  await transporter.sendMail({
    from,
    to,
    subject: `${inviterName} invited you to join ${teamName} on Rivalize`,
    html: buildInviteEmailHtml({ inviterName, teamName, inviteUrl }),
    text: `${inviterName} invited you to join ${teamName} on Rivalize.\n\nAccept your invite: ${inviteUrl}\n\nThis link expires in 7 days.`,
  })
}

function buildInviteEmailHtml({
  inviterName,
  teamName,
  inviteUrl,
}: {
  inviterName: string
  teamName: string
  inviteUrl: string
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07080e;font-family:'Inter',system-ui,sans-serif;color:#F0F0F6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07080e;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Logo -->
        <tr><td style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:linear-gradient(135deg,#8B7CFF,#5a4de0);border-radius:9px;width:32px;height:32px;text-align:center;vertical-align:middle;">
              <span style="color:#fff;font-size:16px;font-weight:900;">&#9889;</span>
            </td>
            <td style="padding-left:10px;font-size:14px;font-weight:800;letter-spacing:0.06em;color:#F0F0F6;">RIVALIZE</td>
          </tr></table>
        </td></tr>
        <!-- Card -->
        <tr><td style="background:#181a2e;border:1px solid rgba(255,255,255,0.10);border-radius:16px;padding:40px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8B7CFF;">Team Invitation</p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#F0F0F6;line-height:1.2;">
            You&apos;re invited to join<br><span style="color:#8B7CFF;">${teamName}</span>
          </h1>
          <p style="margin:0 0 32px;font-size:15px;color:rgba(240,240,246,0.65);line-height:1.6;">
            <strong style="color:#F0F0F6;">${inviterName}</strong> has invited you to join their CS2 team on Rivalize &mdash; demo analysis, AI coaching, and opponent scouting.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(160deg,#8B7CFF,#5a4de0);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;letter-spacing:-0.01em;">
            Accept Invitation &rarr;
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:rgba(240,240,246,0.32);">
            This invite expires in 7 days. If you don&apos;t have a Rivalize account, you&apos;ll be prompted to create one first.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(240,240,246,0.25);">&copy; 2026 Rivalize &middot; CS2 Team Intelligence</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
