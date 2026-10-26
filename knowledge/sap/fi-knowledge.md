# SAP FI (Financial Accounting) Knowledge Base

## Core FI Modules
- General Ledger (FI-GL): Chart of accounts, posting periods, parallel ledgers
- Accounts Payable (FI-AP): Vendor invoices, payment runs, dunning
- Accounts Receivable (FI-AR): Customer invoices, credit management, collections
- Asset Accounting (FI-AA): Asset lifecycle, depreciation, IFRS16
- Bank Accounting (FI-BL): Bank statements, electronic bank reconciliation
- Travel Management (FI-TV): Expense reports, travel requests

## Key S/4HANA FI Changes
- Universal Journal (ACDOCA) — single source of truth for all FI postings
- New GL replaced by Universal Journal
- Profit Center Accounting merged into Universal Journal
- Material Ledger mandatory in S/4HANA
- Real-time document splitting
- Central Finance for group-wide financial consolidation

## Common FI Configuration Objects
- Company Code (OX02)
- Chart of Accounts (OB13)
- Fiscal Year Variant (OB29)
- Posting Period Variant (OBBO)
- Document Types (OBA7)
- Tolerance Groups (OBA4)
- Payment Terms (OBB8)
- House Banks (FI12)
- Payment Methods (FBZP)

## Key FI Transaction Codes
- FB01: Post document
- FB60: Enter vendor invoice
- FB70: Enter customer invoice
- F-53: Post outgoing payments
- F110: Automatic payment run
- FBZP: Payment program configuration
- F.01: Financial statements
- S_ALR_87012172: G/L account balances

## FI Integration Points
- FI-CO: Cost center assignments, profit center accounting
- FI-MM: Goods receipt/invoice verification (3-way match)
- FI-SD: Billing documents to FI
- FI-HR: Payroll posting to FI
- FI-AA: Asset acquisitions and retirements
- FI-TR: Treasury and cash management

## Common FI Business Processes
1. Procure to Pay (P2P): PO → GR → Invoice → Payment
2. Order to Cash (OTC): Order → Delivery → Billing → Collection
3. Record to Report (RTR): Journal entries → Period close → Financial reporting
4. Fixed Asset lifecycle: Acquisition → Depreciation → Disposal

## FI Public Cloud Restrictions
- Limited to ABAP Cloud APIs
- Use released FI APIs: API_JOURNALENTRYITEMBASIC_SRV
- No direct table access to BKPF/BSEG — use ACDOCA
- Use Business Event Handling for FI events
