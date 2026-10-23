# Email setup (confirmation emails from your own name)

Supabase's built-in sender is for testing only: it sends from a Supabase address and is limited to a few emails per hour.
To send from your own name and address, use custom SMTP.

1. Supabase dashboard → **Authentication → Emails → SMTP Settings** → turn on **Custom SMTP**.
   Fill in the host, port, username and password from your email provider (see options below), and set
   **Sender name** (e.g. `Shelf`) and **Sender email**.
2. **Authentication → Emails → Templates → Confirm signup**: set **Subject** to `Confirm your Shelf account`
   and paste the contents of `confirm-signup.html` into the message body.
3. **Authentication → URL Configuration**: set **Site URL** to your deployed address, and add it under Redirect URLs.
4. Keep **Authentication → Providers → Email → Confirm email** switched on.

Enter the SMTP password only in the Supabase dashboard. Never put it in this project's files or send it in chat.

## Provider options
- **Brevo** (free ~300 emails/day): verify one sender address (your own email), no domain needed. Easiest start.
- **Resend** (free ~100/day): looks most professional, but needs a domain you own for a custom sender.
- **Gmail** (App Password): works for a handful of users; the sender shows as your Gmail address and Google may throttle it.
