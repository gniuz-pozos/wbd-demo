let config;
let elementsInstance;
let cardElement;
let state = { planCode: null, extraMembers: 0, account: null };

// Demo billing address, sent with every token request
const DEMO_ADDRESS = {
  address1: '1 Demo Street',
  city: 'San Francisco',
  state: 'CA',
  postal_code: '94105',
  country: 'US'
};

const show = (id) => {
  document.querySelectorAll('.step').forEach((s) => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
};

async function init() {
  config = await (await fetch('/api/config')).json();
  recurly.configure({ publicKey: config.publicKey });

  elementsInstance = recurly.Elements();
  cardElement = elementsInstance.CardElement();
  cardElement.attach('#card-element');

  renderPlans();
  bindEvents();
}

function renderPlans() {
  const grid = document.getElementById('plan-grid');
  Object.entries(config.plans).forEach(([code, p]) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'plan';
    card.dataset.code = code;
    card.innerHTML = `
      <h2>${p.name}</h2>
      <div class="price">$${p.price.toFixed(2)}<span>/month</span></div>
      <ul>
        <li>Stream on ${p.devices} devices at once</li>
        <li>${p.quality} resolution</li>
      </ul>`;
    card.addEventListener('click', () => {
      document.querySelectorAll('.plan').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      state.planCode = code;
    });
    grid.appendChild(card);
  });
  // Pre-select the middle plan
  grid.querySelector('[data-code="hbomax_std_monthly_usa"]').click();
}

function bindEvents() {
  const qty = document.getElementById('qty');
  document.getElementById('qty-plus').onclick = () => {
    state.extraMembers = Math.min(state.extraMembers + 1, 4);
    qty.textContent = state.extraMembers;
  };
  document.getElementById('qty-minus').onclick = () => {
    state.extraMembers = Math.max(state.extraMembers - 1, 0);
    qty.textContent = state.extraMembers;
  };

  document.getElementById('to-account').onclick = () => show('step-account');

  document.querySelectorAll('[data-back]').forEach((btn) =>
    btn.addEventListener('click', () => show(btn.dataset.back))
  );

  document.getElementById('account-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const err = document.getElementById('account-err');
    if (f.email.value !== f.emailConfirm.value) {
      err.textContent = 'Email addresses must match.';
      return;
    }
    err.textContent = '';
    state.account = {
      email: f.email.value,
      password: f.password.value,
      firstName: f.firstName.value,
      lastName: f.lastName.value
    };
    fillSummary();
    show('step-payment');
  });

  document.getElementById('payment-form').addEventListener('submit', onPay);
}

function fillSummary() {
  const plan = config.plans[state.planCode];
  document.getElementById('summary').innerHTML = `
    <div><span>Plan</span><strong>${plan.name}</strong></div>
    <div><span>Monthly price</span><strong>$${plan.price.toFixed(2)}</strong></div>
    <div><span>Extra members</span><strong>${state.extraMembers}</strong></div>`;
}

function formatTokenError(tokenErr) {
  const fields = (tokenErr?.details || [])
    .map((d) => (d.field ? `${d.field}: ${d.messages?.join(', ') || d.message}` : d.message))
    .filter(Boolean);
  return fields.length ? fields.join(' · ') : (tokenErr?.message || 'Card details are invalid.');
}

async function onPay(e) {
  e.preventDefault();
  const err = document.getElementById('payment-err');
  const btn = document.getElementById('pay-btn');
  err.textContent = '';
  btn.disabled = true;

  const billing = {
    first_name: document.getElementById('card-first').value.trim(),
    last_name: document.getElementById('card-last').value.trim(),
    ...DEMO_ADDRESS
  };

  // Card number is captured inside Recurly's hosted field and never reaches this code
  let token;
  try {
    token = await new Promise((resolve, reject) => {
      recurly.token(elementsInstance, billing, (tokenErr, tok) => {
        if (tokenErr) reject(tokenErr);
        else resolve(tok);
      });
    });
  } catch (tokenErr) {
    console.error('recurly.js token error', tokenErr);
    err.textContent = formatTokenError(tokenErr);
    btn.disabled = false;
    return;
  }

  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planCode: state.planCode,
        extraMembers: state.extraMembers,
        account: state.account,
        tokenId: token.id
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Payment failed');
    renderConfirm(data);
    show('step-confirm');
  } catch (ex) {
    err.textContent = ex.message;
  } finally {
    btn.disabled = false;
  }
}

function renderConfirm(d) {
  document.getElementById('confirm-body').innerHTML = `
    <p>Your WBD subscription is active.</p>
    <div class="summary">
      <div><span>Plan</span><strong>${d.plan}</strong></div>
      <div><span>Status</span><strong>${d.state}</strong></div>
      <div><span>Account</span><strong>${d.accountCode}</strong></div>
      <div><span>Subscription ID</span><strong>${d.subscriptionId}</strong></div>
    </div>`;
}

async function init() {
  try {
    config = await (await fetch('/api/config')).json();
  } catch (e) {
    document.getElementById('plan-grid').textContent = 'Could not load plans.';
    console.error('Failed to load /api/config', e);
    return;
  }

  renderPlans();
  bindEvents();

  try {
    recurly.configure({ publicKey: config.publicKey });
    elementsInstance = recurly.Elements();
    cardElement = elementsInstance.CardElement();
    cardElement.attach('#card-element');
  } catch (e) {
    console.error('Recurly setup failed', e);
  }
}
