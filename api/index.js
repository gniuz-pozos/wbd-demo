require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

const RECURLY_API = 'https://v3.recurly.com';
const PRIVATE_KEY = process.env.RECURLY_PRIVATE_KEY;

const PLANS = {
  hbomax_basic_monthly_usa: { name: 'Basic', price: 10.99, devices: 2, quality: 'Full HD' },
  hbomax_std_monthly_usa: { name: 'Standard', price: 18.49, devices: 2, quality: 'Full HD' },
  hbomax_premium_monthly_usa: { name: 'Premium', price: 22.99, devices: 4, quality: '4K UHD' }
};
const EXTRA_MEMBER_CODE = 'extra_member';

app.get('/api/config', (req, res) => {
  res.json({ publicKey: process.env.RECURLY_PUBLIC_KEY, plans: PLANS, extraMemberCode: EXTRA_MEMBER_CODE });
});

async function recurly(path, options = {}) {
  const res = await fetch(`${RECURLY_API}${path}`, {
    ...options,
    headers: {
      Authorization: 'Basic ' + Buffer.from(PRIVATE_KEY + ':').toString('base64'),
      Accept: 'application/vnd.recurly.v2021-02-25',
      'Accept-Language': 'en-US',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error?.message || 'Recurly error'), { status: res.status, body });
  return body;
}

app.post('/api/subscribe', async (req, res) => {
  const { planCode, extraMembers = 0, account, tokenId } = req.body;

  if (!PLANS[planCode]) return res.status(400).json({ error: 'Unknown plan' });
  if (!account?.email || !account?.firstName || !account?.lastName || !account?.password) {
    return res.status(400).json({ error: 'Account details are incomplete' });
  }
  if (!tokenId) return res.status(400).json({ error: 'Missing payment token' });

  const accountCode = `wbd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const payload = {
    plan_code: planCode,
    currency: 'USD',
    account: {
      code: accountCode,
      email: account.email,
      first_name: account.firstName,
      last_name: account.lastName,
      billing_info: { token_id: tokenId }
    },
    add_ons: extraMembers > 0
      ? [{ code: EXTRA_MEMBER_CODE, add_on_source: 'item', quantity: extraMembers }]
      : []
  };

  try {
    const sub = await recurly('/subscriptions', { method: 'POST', body: JSON.stringify(payload) });
    res.json({
      accountCode,
      subscriptionId: sub.id,
      plan: sub.plan?.name,
      state: sub.state,
      currentPeriodEndsAt: sub.current_period_ends_at,
      total: sub.total,
      currency: sub.currency
    });
  } catch (err) {
    console.error('Recurly subscribe error', err.status, JSON.stringify(err.body, null, 2));
    res.status(err.status || 500).json({ error: err.message, details: err.body });
  }
});

// Local development only. Vercel ignores this and uses the exported app.
if (require.main === module) {
  app.use(require('express').static('public'));
  app.listen(process.env.PORT || 3000, () => {
    console.log(`WBD demo running on http://localhost:${process.env.PORT || 3000}`);
  });
}

module.exports = app;