import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const CATEGORIES = ['Bug Report', 'Feature Request', 'General Feedback', 'Data Issue', 'Other'] as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, category, subject, message, userId } = body

    // Validate required fields
    if (!name || !email || !category || !subject || !message) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (!CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    if (message.length < 10) {
      return NextResponse.json({ error: 'Message must be at least 10 characters' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('RESEND_API_KEY not configured')
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    const resend = new Resend(apiKey)
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a1a1a;margin-bottom:4px">${category}</h2>
        <p style="color:#666;font-size:13px;margin-top:0">Received ${timestamp} PT</p>

        <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px">
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;width:100px">From</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${name} &lt;${email}&gt;</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold">Category</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${category}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold">Subject</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${subject}</td>
          </tr>
          ${userId ? `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold">User ID</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666">${userId}</td>
          </tr>` : ''}
        </table>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;white-space:pre-wrap;font-size:14px;line-height:1.6">${message}</p>
        </div>

        <p style="margin-top:24px;color:#999;font-size:11px">
          Submitted via NextRebuy feedback form${userId ? ' (authenticated user)' : ' (anonymous)'}.
        </p>
      </div>
    `

    await resend.emails.send({
      from: 'NextRebuy Feedback <feedback@nextrebuy.com>',
      to: 'support@nextrebuy.com',
      replyTo: email,
      subject: `[NextRebuy Feedback] ${category}: ${subject}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Feedback submission error:', error)
    return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 })
  }
}
