const RECURLY_API = 'https://v3.recurly.com';
const PLANS = {
  hbomax_basic_monthly_usa: true,
  hbomax_std_monthly_usa: true,
  hbomax_premium_monthly_usa: true
};

async function recurly(path, options = {}) {
  const res = await fetch(`${RECURLY_API}${path}`, {
    ...options,
    headers: {
      Authorization: 'Basic ' + Buffer.from(process.env.RECURLY_PRIVATE_KEY + ':').toString('base64'),
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { planCode, extraMembers = 0, account, tokenId } = req.body || {};

  if (!PLANS[planCode]) return res.status(400).json({ error: 'Unknown plan' });
  if (!account?.email || !account?.firstName || !account?.lastName) {
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
      ? [{ code: 'extra_member', add_on_source: 'item', quantity: extraMembers }]
      : []
  };

  try {
    const sub = await recurly('/subscriptions', { method: 'POST', body: JSON.stringify(payload) });
    res.status(200).json({
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
};