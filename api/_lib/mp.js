const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "TEST",
});

module.exports = {
  preferenceApi: new Preference(mpClient),
  paymentApi: new Payment(mpClient),
};
