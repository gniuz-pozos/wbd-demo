const PLANS = {
  hbomax_basic_monthly_usa: { name: 'Basic', price: 10.99, devices: 2, quality: 'Full HD' },
  hbomax_std_monthly_usa: { name: 'Standard', price: 18.49, devices: 2, quality: 'Full HD' },
  hbomax_premium_monthly_usa: { name: 'Premium', price: 22.99, devices: 4, quality: '4K UHD' }
};

module.exports = (req, res) => {
  res.status(200).json({
    publicKey: process.env.RECURLY_PUBLIC_KEY,
    plans: PLANS,
    extraMemberCode: 'extra_member'
  });
};