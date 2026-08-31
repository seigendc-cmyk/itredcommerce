# ZIMRA Fiscalisation Reference

Who must fiscalise: all VAT-registered operators (SI 104 of 2010), and also
taxpayers below the USD 25,000 VAT threshold (Section 90, Income Tax Act).

Two integration paths:

Path 1 — Virtual Fiscalisation (API), default fit for iTred:
Software-based, no hardware required. Suitable for any operator with a
connected server/POS system. API spec is free from ZIMRA's site. Official
onboarding sequence:
1. Contact ZIMRA's Fiscalisation Team (via Domestic Taxes Contact Persons
   page) to register for the FDMS TEST environment and get API endpoint
   details.
2. Develop/test against FDMS test environment with dummy data.
3. Generate sample Fiscal Tax Invoices, Credit Notes, Debit Notes in test.
4. Close a fiscal day, confirm no errors.
5. Submit sample documents to ZIMRA for approval.
6. Once approved, register in the FDMS LIVE environment and go live.

Portal links:
- https://www.zimra.co.zw/domestic-taxes/corporate/fiscalisation-explained
- API docs: https://www.zimra.co.zw/downloads/category/9-domestic-taxes?download=3807:fiscalisation-api-documentation
- Public Notice 26/2024: https://www.zimra.co.zw/public-notices?download=3847:public-notice-26-of-2024-zimra-virtual-fiscalisation-and-api-fdms
- Approved suppliers: https://www.zimra.co.zw/domestic-taxes/vat/approved-suppliers-of-fiscal-devices
- Contacts: https://www.zimra.co.zw/domestic-taxes/domestic-taxes-contact-persons

Note: exact sandbox hostname isn't published publicly — issued directly upon
registering via the Fiscalisation Team contact above. Do not hardcode a
sandbox URL from a third-party repo without confirming it's current.

Path 2 — Hardware fiscal device: physical device from a ZIMRA-Approved
Supplier, handles install/test/training. Fallback path only, for a tenant
that already owns fiscal hardware. Financial incentive: 50% of device cost
claimable as Input Tax on VAT7, remaining 50% as SIA over 2 years on Income
Tax Return, plus duty rebates and VAT zero-rating on local supply.

Other target countries (near-term, not this prompt):
- Zambia (ZRA Smart Invoice): real-time, per-invoice, via VSDC module,
  returns a Mark ID + QR code.
- Malawi (MRA EIS): real-time, per-invoice REST/JSON API.
- Mozambique (AT): NOT confirmed real-time — periodic (monthly) batch file
  submission, moving toward OECD SAF-T format. Genuinely different
  submission mode from the other three.
