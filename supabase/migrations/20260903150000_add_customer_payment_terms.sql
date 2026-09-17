/*
  # Customer payment terms

  Payment terms are part of how a customer is priced — they are the reason two
  customers on the same price list are not on the same deal — and the demo
  walkthrough presents them as one of the customer attributes on screen. The
  schema had no column for them at all, so the screen could not show them and
  nothing could be captured against a customer.

  Terms are stored as free text rather than an enum. ITT's terms are
  negotiated per account and the vocabulary is not fixed ("Net 30", "2/10 Net
  30", "Net 45 EOM"), so a constrained list would reject real values; the
  application offers the common ones and accepts anything.

  The column is nullable with no default. The customer extract ITT supplied
  (Customer No, Customer Name, Region, State, Sales Person, Industry/Type,
  Channel) does not carry payment terms, so every imported customer starts
  without them, and NULL says that honestly. Defaulting to 'Net 30' would put
  a term ITT never stated against 218 real accounts.
*/

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS payment_terms text;

COMMENT ON COLUMN customers.payment_terms IS
  'Negotiated payment terms, free text (e.g. "Net 30"). NULL means not recorded.';
