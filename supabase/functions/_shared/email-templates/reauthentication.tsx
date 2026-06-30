/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your UCU verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandBar}>
          <Text style={brand}>UCU</Text>
          <Text style={brandSub}>Unified Commerce Ultra</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Confirm it's you</Heading>
          <Text style={text}>Use the code below to confirm your identity:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>
            This code expires shortly. If you didn't request this, you can safely ignore this email.
          </Text>
        </Section>
        <Text style={legal}>© {new Date().getFullYear()} UCU — Unified Commerce Ultra</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '24px 16px', maxWidth: '560px', margin: '0 auto' }
const brandBar = { textAlign: 'center' as const, padding: '8px 0 20px' }
const brand = { fontSize: '24px', fontWeight: 800 as const, color: 'hsl(158, 84%, 39%)', margin: '0', letterSpacing: '0.5px' }
const brandSub = { fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '2px', color: '#6b7280', margin: '4px 0 0' }
const card = { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '28px 24px' }
const h1 = { fontSize: '22px', fontWeight: 700 as const, color: '#0f172a', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 14px' }
const codeStyle = { fontFamily: "'JetBrains Mono', Courier, monospace", fontSize: '28px', letterSpacing: '6px', fontWeight: 700 as const, color: 'hsl(158, 84%, 39%)', background: '#f8fafc', borderRadius: '10px', padding: '14px 20px', textAlign: 'center' as const, margin: '0 0 24px' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '20px 0 0', lineHeight: '1.5' }
const legal = { fontSize: '11px', color: '#9ca3af', textAlign: 'center' as const, margin: '20px 0 0' }
