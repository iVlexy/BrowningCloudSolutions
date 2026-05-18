export type Env = {
  DB: D1Database
  AI: Ai
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  SENDGRID_API_KEY: string
  CF_TEAM_DOMAIN: string
  FRONTEND_URL: string
  FROM_EMAIL: string
  COMPANY_NAME: string
  PLAID_CLIENT_ID: string
  PLAID_SECRET: string
  PLAID_BASE_URL: string
}

export type Variables = {
  userEmail: string
}
