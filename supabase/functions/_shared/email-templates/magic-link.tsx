/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your sign-in link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brand}>UCU</Text>
          <Text style={brandSub}>Unified Commerce Ultra</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Sign in to {siteName}</Heading>
          <Text style={text}>
            Click the button below to sign in. This link expires shortly for your security.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Sign in
          </Button>
          <Text style={footer}>
            If you didn't request this link, you can safely ignore this email.
          </Text>
        </Section>
        <Text style={legal}>© {new Date().getFullYear()} UCU — Unified Commerce Ultra</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '24px 16px', maxWidth: '560px', margin: '0 auto' }
const brandBar = { textAlign: 'center' as const, padding: '8px 0 20px' }
const brand = { fontSize: '24px', fontWeight: 800 as const, color: 'hsl(158, 84%, 39%)', margin: '0', letterSpacing: '0.5px' }
const brandSub = { fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '2px', color: '#6b7280', margin: '4px 0 0' }
const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '28px 24px' }
const h1 = { fontSize: '22px', fontWeight: 700 as const, color: '#0f172a', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 22px' }
const button = { backgroundColor: 'hsl(158, 84%, 39%)', color: '#ffffff', fontSize: '14px', fontWeight: 600 as const, borderRadius: '10px', padding: '12px 22px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0', lineHeight: '1.5' }
const legal = { fontSize: '11px', color: '#9ca3af', textAlign: 'center' as const, margin: '20px 0 0' }
